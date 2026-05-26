# Cat Game

金渐层大战猫猫小游戏固定项目目录。

## Local Run

```bash
npm start
```

or:

```bash
node server.js
```

Then open:

```text
http://localhost:8765
```

## Deploy

This is a Node.js web app because online rooms use WebSocket.

### Render

1. Push this folder to a GitHub repository.
2. In Render, create a new Blueprint or Web Service from the repository.
3. If using Web Service manually:
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
4. Open the Render URL after deploy.

### Railway

1. Push this folder to a GitHub repository.
2. Create a Railway project from the repository.
3. Railway should detect Node.js automatically.
4. Start command: `npm start`
5. Open the generated Railway domain after deploy.

The server listens on `process.env.PORT`, so it works on platforms that assign a dynamic port.

Original Codex date folder:

```text
/Users/lichee/Documents/Codex/2026-05-16/new-chat
```
