import express from "express";
import http from "http";
import env from "dotenv";
import type { Request, Response } from "express";
import { matchRouter } from "./routes/matches";
import { attachWebSocketServer } from "./ws/server";
import { securityMiddleware } from "./arcjet";

env.config({ quiet: true });
const app = express();
const server = http.createServer(app);
app.use(express.json());

const PORT = Number(process.env.SERVER_BACKEND_PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(securityMiddleware());

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ a7a: "a7a" });
});

app.use("/matches", matchRouter);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`app is listening to port ${baseUrl}`);
  console.log(
    `WebSocket Server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
