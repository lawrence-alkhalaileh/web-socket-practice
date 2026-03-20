import { WebSocket, WebSocketServer } from "ws";
import type { Server as HttpServer } from "http";
import { Match } from "../utils/match-status";

type JsonPayload = Record<string, unknown>;

type WebSocketAPI = {
  broadcastMatchCreated: (match: Match) => void;
};

function sendJson(socket: WebSocket, payload: JsonPayload): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: JsonPayload): void {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }
    client.send(JSON.stringify(payload));
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

  wss.on("connection", (socket) => {
    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match: Match): void {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
