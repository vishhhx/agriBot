import { createServer, type IncomingMessage } from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { app } from "./app";
import {
  broadcastRobotStatus,
  broadcastRobotDisconnected,
  handleWebsocketMessages,
  cleanupWebSocketConnection,
} from "./websocket/handler";
import { robots, removeRobotIfEmpty } from "./websocket/state";
import { connectToMongoDB } from "./connect/mongodb";
import { Robot } from "./models/robot";
import { verifyAuthToken } from "./services/auth";
import { send } from "./websocket/connections";
const server = createServer(app);
const wss = new WebSocketServer({
  server,
});

await connectToMongoDB();

const getSessionUserId = (request: IncomingMessage): string | undefined => {
  // --------------------------------------------------
  // 1. Try the __session cookie (same-origin requests)
  // --------------------------------------------------

  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__session="));

  const cookieToken = cookie
    ? decodeURIComponent(cookie.slice("__session=".length))
    : undefined;

  // --------------------------------------------------
  // 2. Try ?token= query parameter
  //
  // Browsers cannot send cookies on cross-origin
  // WebSocket connections (e.g. devtunnel → localhost).
  // The frontend appends __session as ?token= instead.
  // --------------------------------------------------

  const url = request.url ?? "";
  const queryStart = url.indexOf("?");
  const queryToken =
    queryStart !== -1
      ? new URLSearchParams(url.slice(queryStart)).get("token") ?? undefined
      : undefined;

  const token = cookieToken ?? queryToken;

  if (!token) return undefined;

  try {
    return verifyAuthToken(token).userId;
  } catch {
    return undefined;
  }
};

wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
  const authenticatedUserId = getSessionUserId(request);
  console.log(`[WS CONNECT] ${authenticatedUserId ? `user=${authenticatedUserId}` : "unauthenticated client"} ip=${request.socket.remoteAddress || "unknown"}`);

  ws.on("message", (message: RawData, isBinary: boolean) => {
    void handleWebsocketMessages(wss, ws, message, isBinary, authenticatedUserId);
  });

  ws.on("close", () => {
    console.log(`[WS DISCONNECT] ${authenticatedUserId ? `user=${authenticatedUserId}` : "unauthenticated client"}`);
    cleanupWebSocketConnection(ws);

    for (const [robotId, robot] of robots.entries()) {
      for (const [userId, user] of robot.users.entries()) {
        if (user.ws === ws) {
          robot.users.delete(userId);

          console.log(`[USER] ${userId} disconnected from robot ${robotId}`);
        }
      }

      let botDisconnected = false;
      for (const [role, bot] of robot.bots.entries()) {
        if (bot.ws === ws) {
          robot.bots.delete(role);
          botDisconnected = true;

          console.log(
            `[BOT] ${bot.botId} (${role}) disconnected from robot ${robotId}`,
          );

          // Broadcast role status update to subscribed users
          for (const user of robot.users.values()) {
            if (role === "MOVEMENT_AND_OTHER") {
              send(user.ws, { type: "movement:status", robotId, connected: false });
            } else if (role === "CAMERA") {
              send(user.ws, { type: "camera:status", robotId, connected: false });
            } else if (role === "WATER_PUMP") {
              send(user.ws, { type: "water:status", robotId, connected: false });
            } else if (role === "SERVO") {
              send(user.ws, { type: "servo:status", robotId, connected: false });
            }
          }
        }
      }

      if (botDisconnected && robot.bots.size === 0) {
        void Robot.updateOne({ robotId }, { $set: { status: "offline" } });
        broadcastRobotDisconnected(robotId);
        broadcastRobotStatus(robotId, "offline");
      }

      removeRobotIfEmpty(robotId);
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

const port = Number(process.env.PORT) || 5000;

server.listen(port, () => {
  console.log(`HTTP + WebSocket server listening on port ${port}`);
});
