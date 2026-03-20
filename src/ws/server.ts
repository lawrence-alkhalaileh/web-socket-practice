import { WebSocket, WebSocketServer } from "ws";
import type { Server as HttpServer } from "http";
import { Match } from "../utils/match-status";

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
    server,
    path: "/ws",
    // prevent memory abuse / flooding
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket: WebSocketWithAlive) => {
    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

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
