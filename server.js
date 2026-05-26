const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const rooms = new Map();

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const rawPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, rawPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": types[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(data);
  });
});

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const roomId = cleanRoom(url.searchParams.get("room"));
  const room = rooms.get(roomId) || [];
  if (room.length >= 2) {
    acceptSocket(req, socket);
    sendFrame(socket, { type: "full" });
    socket.end();
    return;
  }

  acceptSocket(req, socket);

  const peer = {
    role: room.some((item) => item.role === "long") ? "short" : "long",
    roomId,
    socket
  };
  room.push(peer);
  rooms.set(roomId, room);

  sendFrame(socket, { type: "assign", role: peer.role, ready: room.length === 2 });
  if (room.length === 2) broadcast(roomId, { type: "ready" });

  socket.on("data", (chunk) => {
    for (const payload of readFrames(chunk)) {
      let message;
      try {
        message = JSON.parse(payload);
      } catch {
        continue;
      }

      if (message.type === "input") {
        broadcast(roomId, {
          type: "input",
          role: peer.role,
          input: cleanInput(message.input)
        }, socket);
      }

      if (message.type === "cosmetic") {
        broadcast(roomId, {
          type: "cosmetic",
          role: peer.role,
          cosmetics: cleanCosmetics(message.cosmetics)
        }, socket);
      }

      if (message.type === "state" && peer.role === "long") {
        broadcast(roomId, message, socket);
      }

      if (message.type === "round" && peer.role === "long") {
        broadcast(roomId, {
          type: "round",
          roundId: Number(message.roundId) || 0,
          themeIndex: Number(message.themeIndex) || 0,
          status: String(message.status || "")
        }, socket);
      }

      if (message.type === "restart") {
        broadcast(roomId, { type: "restart" }, socket);
      }
    }
  });

  socket.on("close", () => leave(peer));
  socket.on("error", () => leave(peer));
});

server.listen(PORT, HOST, () => {
  const localHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
  console.log(`金渐层大战已启动: http://${localHost}:${PORT}`);
  console.log("部署时请使用平台提供的公网域名访问。");
});

function acceptSocket(req, socket) {
  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));
}

function sendFrame(socket, value) {
  if (socket.destroyed) return;
  const payload = Buffer.from(JSON.stringify(value));
  let header;

  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

function readFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    const opcode = byte1 & 0x0f;
    const masked = (byte2 & 0x80) !== 0;
    let length = byte2 & 0x7f;
    offset += 2;

    if (length === 126) {
      if (offset + 2 > buffer.length) break;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (offset + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    const mask = masked ? buffer.subarray(offset, offset + 4) : null;
    if (masked) offset += 4;
    if (offset + length > buffer.length) break;

    const payload = Buffer.from(buffer.subarray(offset, offset + length));
    offset += length;

    if (opcode === 0x8) break;
    if (opcode !== 0x1) continue;

    if (mask) {
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] ^= mask[i % 4];
      }
    }
    messages.push(payload.toString("utf8"));
  }

  return messages;
}

function broadcast(roomId, message, except) {
  const room = rooms.get(roomId) || [];
  room.forEach((peer) => {
    if (peer.socket !== except) sendFrame(peer.socket, message);
  });
}

function leave(peer) {
  const room = rooms.get(peer.roomId);
  if (!room) return;
  const next = room.filter((item) => item.socket !== peer.socket);
  if (next.length === 0) {
    rooms.delete(peer.roomId);
  } else {
    rooms.set(peer.roomId, next);
    broadcast(peer.roomId, { type: "peerLeft" });
  }
}

function cleanRoom(value) {
  return String(value || "ORANGE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "ORANGE";
}

function cleanInput(input) {
  return {
    up: Boolean(input && input.up),
    down: Boolean(input && input.down),
    left: Boolean(input && input.left),
    right: Boolean(input && input.right),
    fire: Boolean(input && input.fire)
  };
}

function cleanCosmetics(cosmetics) {
  return {
    hat: Boolean(cosmetics && cosmetics.hat),
    glasses: Boolean(cosmetics && cosmetics.glasses),
    cannon: Boolean(cosmetics && cosmetics.cannon)
  };
}
