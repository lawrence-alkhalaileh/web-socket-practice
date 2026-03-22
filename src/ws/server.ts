import { WebSocket, WebSocketServer } from "ws";
import type { Server as HttpServer } from "http";
import { Match } from "../utils/match-status";
import { arcjetWebSocketConfig } from "../arcjet";
import { IncomingMessage } from "http";

type JsonPayload = Record<string, unknown>;

type WebSocketAPI = {
  broadcastMatchCreated: (match: Match) => void;
};

interface WebSocketWithAlive extends WebSocket {
  isAlive: boolean;
}

function sendJson(socket: WebSocketWithAlive, payload: JsonPayload): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: JsonPayload): void {
  for (const client of wss.clients) {
    const wsClient = client as WebSocketWithAlive;
    if (wsClient.readyState !== WebSocket.OPEN) {
      continue;
    }
    wsClient.send(JSON.stringify(payload));
  }
}

// avoid running separate ports for webSockets
export function attachWebSocketServer(server: HttpServer): WebSocketAPI {
  const wss = new WebSocketServer({
    noServer: true,
    // prevent memory abuse / flooding
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req: IncomingMessage, socket, head) => {
    const { pathname } = new URL(req.url!, `http://${req.headers.host}`);

    if (pathname !== "/ws") {
      return;
    }

    if (arcjetWebSocketConfig) {
      try {
        const decision = await arcjetWebSocketConfig.protect(req);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
          } else {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          }
          socket.destroy();
          return;
        }
      } catch (e) {
        console.error("WS upgrade protection error", e);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on(
    "connection",
    async (socket: WebSocketWithAlive, req: IncomingMessage) => {
      socket.isAlive = true;

      socket.on("pong", () => {
        socket.isAlive = true;
      });

      sendJson(socket, { type: "welcome" });

      socket.on("error", (err) => {
        console.error(err);
        socket.terminate();
      });

      socket.on("close", () => {
        socket.terminate();
      });
    },
  );

  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as WebSocketWithAlive;
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match: Match): void {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
