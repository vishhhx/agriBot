import { WebSocketServer, WebSocket, type RawData } from "ws";

import { RobotConnection } from "../models/robotConnection";
import { Robot } from "../models/robot";
import User from "../models/user";

import { robots, removeRobotIfEmpty } from "./state";
import {
  connections,
  send,
  getConnectionLabel,
  getEventDetails,
} from "./connections";
import { isBotRole } from "./roles";
import { type Message } from "./types";
import { broadcastRobotStatus, broadcastRobotDisconnected } from "./broadcast";
import { subscribeUserToRobot } from "./handlers/subscription";
import {
  registerRobot,
  handleRobotTelemetry,
  handleRobotStatus,
} from "./handlers/robot";
import {
  handleCameraEvent,
  handleCameraFrame,
  handleCameraStreamCommand,
} from "./handlers/camera";
import {
  handleCameraServoCommand,
  handleSprayServoCommand,
  handleServoEvent,
} from "./handlers/servo";
import {
  handleWaterRefillCommand,
  handleWaterSprayCommand,
  handleWaterEvent,
} from "./handlers/water";

export { broadcastRobotStatus, broadcastRobotDisconnected };

// =====================================================
// HANDLE WEBSOCKET MESSAGES
// =====================================================

export async function handleWebsocketMessages(
  wss: WebSocketServer,
  ws: WebSocket,
  rawMessage: RawData,
  isBinary: boolean,
  authenticatedUserId?: string,
) {
  try {
    // =================================================
    // BINARY MESSAGE
    //
    // Camera JPEG frames arrive here when isBinary is true.
    // =================================================

    if (isBinary) {
      handleCameraFrame(ws, rawMessage);
      return;
    }

    // =================================================
    // JSON MESSAGE
    // =================================================

    const rawString = (rawMessage as Buffer).toString();

    console.log("[WS RAW IN]", rawString);

    const message = JSON.parse(rawString) as Message;

    if (message.type === "robot:register") {
      console.log("[ROBOT REGISTER REQUEST]", JSON.stringify(message, null, 2));
    }

    const event = getEventDetails(message);

    console.log(
      `[WS IN] ` +
        `user=${authenticatedUserId || "anonymous"} ` +
        `${getConnectionLabel(ws)} ` +
        `event=${event.type} ` +
        `robot=${event.robotId}`,
    );

    // =================================================
    // MESSAGE SWITCH
    // =================================================

    switch (message.type) {
      // ===============================================
      // ROBOT REGISTER
      // ===============================================

      case "robot:register": {
        await registerRobot(ws, message);

        break;
      }

      // ===============================================
      // USER SUBSCRIBE
      // ===============================================

      case "robot:subscribe": {
        if (!authenticatedUserId) {
          send(ws, {
            type: "ERROR",
            message: "Authentication required",
          });

          return;
        }

        if (!message.robotId) {
          send(ws, {
            type: "ERROR",
            message: "robotId is required",
          });

          return;
        }

        const roles = Array.isArray(message.roles)
          ? message.roles.filter(isBotRole)
          : [];

        if (roles.length === 0) {
          send(ws, {
            type: "robot:error",
            robotId: message.robotId,
            message: "At least one valid role is required",
          });

          return;
        }

        await subscribeUserToRobot(
          ws,
          authenticatedUserId,
          message.robotId,
          roles,
        );

        break;
      }

      // ===============================================
      // USER UNSUBSCRIBE
      // ===============================================

      case "robot:unsubscribe": {
        const connection = connections.get(ws);

        const robot = robots.get(message.robotId);

        if (connection?.type === "USER" && robot) {
          // -------------------------------------------
          // REMOVE SUBSCRIPTION
          // -------------------------------------------

          connection.robotIds.delete(message.robotId);

          connection.roles.delete(message.robotId);

          // -------------------------------------------
          // REMOVE USER FROM ROBOT
          // -------------------------------------------

          if (robot.users.get(connection.userId)?.ws === ws) {
            robot.users.delete(connection.userId);
          }

          console.log(
            `[WS UNSUBSCRIBE] ` +
              `user=${connection.userId} ` +
              `robot=${message.robotId}`,
          );

          removeRobotIfEmpty(message.robotId);
        }

        break;
      }

      // ===============================================
      // MOVEMENT
      // ===============================================

      case "robot:movement": {
        const connection = connections.get(ws);
        const { robotId, role, command, speed, requestId } = message;

        // 1. Authentication Check
        if (!authenticatedUserId || !connection || connection.type !== "USER") {
          console.warn(
            `[WS COMMAND REJECTED] reason=Authentication required user=${authenticatedUserId ?? "none"}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId: robotId || "",
            requestId: requestId || "",
            reason: "Authentication required",
          });
          return;
        }

        console.log(
          `[WS MOVEMENT] ` +
            `user=${authenticatedUserId} ` +
            `robot=${robotId} ` +
            `role=${role} ` +
            `command=${command} ` +
            `speed=${speed} ` +
            `request=${requestId}`,
        );

        // 2. Connection type check (already verified connection.type === "USER")

        // 3. User Subscription Check
        if (!connection.robotIds.has(robotId)) {
          console.warn(
            `[WS COMMAND REJECTED] reason=Robot subscription is required user=${connection.userId} robot=${robotId}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Robot subscription is required",
          });
          return;
        }

        // 4. Role Check
        if (role !== "MOVEMENT_AND_OTHER") {
          console.warn(
            `[WS COMMAND REJECTED] reason=Invalid movement role role=${role}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Invalid movement role",
          });
          return;
        }

        // 5. Command Check
        const validCommands = [
          "FORWARD",
          "BACKWARD",
          "LEFT",
          "RIGHT",
          "STOP",
        ] as const;

        if (!validCommands.includes(command)) {
          console.warn(
            `[WS COMMAND REJECTED] reason=Invalid movement command command=${command}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Invalid movement command",
          });
          return;
        }

        // 6. Speed Check
        if (!Number.isFinite(speed) || speed < 0 || speed > 100) {
          console.warn(
            `[WS COMMAND REJECTED] reason=Invalid movement speed speed=${speed}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Invalid movement speed",
          });
          return;
        }

        // 7. Request ID Check
        if (
          !requestId ||
          typeof requestId !== "string" ||
          requestId.trim() === ""
        ) {
          console.warn(`[WS COMMAND REJECTED] reason=Request ID required`);
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId: "",
            reason: "Request ID is required",
          });
          return;
        }

        // 8. Find User in DB
        const user = await User.findOne({
          userId: connection.userId,
        }).select("_id");

        if (!user) {
          console.warn(
            `[WS COMMAND REJECTED] reason=User not found in database userId=${connection.userId}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "User record not found",
          });
          return;
        }

        // 9. Find Robot Record in DB
        const robotRecord = await Robot.findOne({
          robotId,
        }).select("_id");

        if (!robotRecord) {
          console.warn(
            `[WS COMMAND REJECTED] reason=Robot record not found robot=${robotId}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Robot record not found",
          });
          return;
        }

        // 10. Check Control Permission
        const hasControl = Boolean(
          await RobotConnection.exists({
            userId: user._id,
            robotId: robotRecord._id,
            status: "active",
            "permissions.control": true,
          }),
        );

        if (!hasControl) {
          console.warn(
            `[WS COMMAND REJECTED] reason=You do not have movement permission user=${connection.userId} robot=${robotId}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "You do not have movement permission",
          });
          return;
        }

        console.log(`[WS MOVEMENT AUTHORIZED]`);

        // 11. Find In-Memory Robot
        const robot = robots.get(robotId);

        if (!robot) {
          console.warn(
            `[WS COMMAND REJECTED] reason=Robot not found in memory robot=${robotId}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Robot not found",
          });
          return;
        }

        // 12. Find MOVEMENT_AND_OTHER Bot Module
        const bot = robot.bots.get("MOVEMENT_AND_OTHER");

        if (!bot) {
          console.warn(
            `[WS COMMAND REJECTED] reason=Movement module is not connected robot=${robotId}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Movement module is not connected",
          });
          return;
        }

        console.log(
          `[WS MOVEMENT BOT FOUND] robot=${robotId} role=MOVEMENT_AND_OTHER`,
        );

        // 13. Verify WebSocket State before sending
        if (bot.ws.readyState !== WebSocket.OPEN) {
          console.warn(
            `[WS COMMAND REJECTED] reason=Movement module WebSocket is not open robot=${robotId}`,
          );
          send(ws, {
            type: "robot:command:rejected",
            robotId,
            requestId,
            reason: "Movement module WebSocket is not open",
          });
          return;
        }

        // 14. Forward COMMAND to ESP32
        const espCommand = command.toLowerCase();

        send(bot.ws, {
          type: "COMMAND",
          data: {
            robotId,
            userId: connection.userId,
            command: espCommand,
            speed,
            requestId,
          },
        });

        // 15. Acknowledge Frontend
        send(ws, {
          type: "robot:command:accepted",
          robotId,
          requestId,
        });

        console.log(
          `[WS COMMAND FORWARDED] ` +
            `robot=${robotId} ` +
            `role=MOVEMENT_AND_OTHER ` +
            `command=${espCommand} ` +
            `speed=${speed} ` +
            `request=${requestId}`,
        );

        break;
      }

      // ===============================================
      // ROBOT TELEMETRY
      // ===============================================

      case "robot:telemetry": {
        await handleRobotTelemetry(ws, message);

        break;
      }

      // ===============================================
      // ROBOT STATUS
      // ===============================================

      case "robot:status": {
        await handleRobotStatus(ws, message);

        break;
      }

      // ===============================================
      // CAMERA EVENT  (camera module disabled — uncomment to enable)
      // ===============================================

      // case "camera:event": {
      //   await handleCameraEvent(ws, message);
      //   break;
      // }

      case "camera:stream": {
        handleCameraStreamCommand(ws, message);
        break;
      }

      // ===============================================
      // CAMERA SERVO
      // ===============================================

      case "servo:camera": {
        handleCameraServoCommand(ws, message);

        break;
      }

      // ===============================================
      // SPRAY
      // ===============================================

      case "servo:spray": {
        handleSprayServoCommand(ws, message);

        break;
      }

      // ===============================================
      // SERVO EVENT
      // ===============================================

      case "servo:event": {
        handleServoEvent(ws, message);

        break;
      }

      // ===============================================
      // WATER PUMP — REFILL
      // ===============================================

      case "water:refill": {
        handleWaterRefillCommand(ws, message);

        break;
      }

      // ===============================================
      // WATER PUMP — SPRAY
      // ===============================================

      case "water:spray": {
        handleWaterSprayCommand(ws, message);

        break;
      }

      // ===============================================
      // WATER EVENT (from ESP32 WATER_PUMP module)
      // ===============================================

      case "water:event": {
        handleWaterEvent(ws, message);

        break;
      }

      // ===============================================
      // HORN BEEP  (User → MOVEMENT_AND_OTHER bot)
      // ===============================================

      case "horn:beep": {
        const connection = connections.get(ws);

        if (!connection || connection.type !== "USER") {
          send(ws, { type: "ERROR", message: "Only users can beep the horn" });
          break;
        }

        if (!connection.robotIds.has(message.robotId)) {
          send(ws, { type: "ERROR", message: "Robot subscription required" });
          break;
        }

        const hornRobot = robots.get(message.robotId);
        const movBot = hornRobot?.bots.get("MOVEMENT_AND_OTHER");

        if (!movBot) {
          send(ws, { type: "ERROR", message: "Movement module not connected" });
          break;
        }

        send(movBot.ws, {
          type: "COMMAND",
          data: {
            robotId: message.robotId,
            command: "HORN",
            beeps: message.beeps ?? 1,
            userId: connection.userId,
            requestId: message.requestId,
          },
        });

        send(ws, { type: "horn:accepted", robotId: message.robotId });
        console.log(
          `[HORN] user=${connection.userId} robot=${message.robotId} beeps=${message.beeps ?? 1}`,
        );
        break;
      }

      // ===============================================
      // GENERIC BOT COMMAND
      // ===============================================

      case "BOT_COMMAND": {
        const connection = connections.get(ws);

        console.log(
          `[WS IN BOT_COMMAND] ` +
            `user=${authenticatedUserId || "anonymous"} ` +
            `authenticated=${Boolean(authenticatedUserId)} ` +
            `connectionType=${connection?.type ?? "none"} ` +
            `data=${JSON.stringify(message.data)}`,
        );

        if (!connection || connection.type !== "USER") {
          console.warn(
            `[BOT_COMMAND REJECTED] reason=not-authenticated-user ` +
              `connectionType=${connection?.type ?? "none"} ` +
              `userId=${authenticatedUserId ?? "none"}`,
          );

          send(ws, {
            type: "ERROR",
            message: "Only users can send bot commands",
          });

          return;
        }

        const { robotId, target, payload } = message.data;

        // ---------------------------------------------
        // USER SUBSCRIPTION
        // ---------------------------------------------

        if (!connection.robotIds.has(robotId)) {
          send(ws, {
            type: "ERROR",
            message: "You are not connected to this robot",
          });

          return;
        }

        // ---------------------------------------------
        // ROBOT
        // ---------------------------------------------

        const robot = robots.get(robotId);

        if (!robot) {
          send(ws, {
            type: "ERROR",
            message: "Robot not found",
          });

          return;
        }

        // ---------------------------------------------
        // MODULE
        // ---------------------------------------------

        const bot = robot.bots.get(target);

        if (!bot) {
          send(ws, {
            type: "ERROR",
            message: `Bot ${target} is not connected`,
          });

          return;
        }

        // ---------------------------------------------
        // SEND COMMAND
        // ---------------------------------------------

        console.log(
          `[WS OUT BOT_COMMAND] ` +
            `bot=${robotId} ` +
            `role=${target} ` +
            `payload=${JSON.stringify(payload)}`,
        );

        send(bot.ws, {
          type: "COMMAND",

          data: {
            robotId,

            userId: connection.userId,

            payload,
          },
        });

        break;
      }

      // ===============================================
      // GENERIC BOT EVENT
      // ===============================================

      case "BOT_EVENT": {
        const connection = connections.get(ws);

        if (!connection || connection.type !== "BOT") {
          send(ws, {
            type: "ERROR",
            message: "Only bots can send bot events",
          });

          return;
        }

        const { robotId, payload } = message.data;

        // ---------------------------------------------
        // ROBOT CHECK
        // ---------------------------------------------

        if (connection.robotId !== robotId) {
          send(ws, {
            type: "ERROR",
            message: "Invalid robot",
          });

          return;
        }

        const robot = robots.get(robotId);

        if (!robot) {
          return;
        }

        // ---------------------------------------------
        // FORWARD EVENT
        // ---------------------------------------------

        for (const user of robot.users.values()) {
          const userConnection = connections.get(user.ws);

          if (!userConnection || userConnection.type !== "USER") {
            continue;
          }

          const roles = userConnection.roles.get(robotId);

          const matchingRole = Array.from(connection.roles).find((r) =>
            roles?.has(r),
          );

          if (!matchingRole) {
            continue;
          }

          send(user.ws, {
            type: "robot:event",
            robotId,
            role: matchingRole,
            payload,
          });
        }

        break;
      }

      // ===============================================
      // UNKNOWN
      // ===============================================

      default: {
        send(ws, {
          type: "ERROR",
          message: "Unknown message type",
        });

        break;
      }
    }
  } catch (error) {
    console.error("[WS MESSAGE ERROR]", error);

    send(ws, {
      type: "ERROR",
      message: "Invalid WebSocket message",
    });
  }
}

// =====================================================
// CLEANUP CONNECTION
// =====================================================

export function cleanupWebSocketConnection(ws: WebSocket) {
  const connection = connections.get(ws);

  if (!connection) {
    return;
  }

  // ===================================================
  // BOT CLEANUP
  // ===================================================

  if (connection.type === "BOT") {
    const robot = robots.get(connection.robotId);

    if (robot) {
      for (const role of connection.roles) {
        const currentBot = robot.bots.get(role);
        if (currentBot?.ws === ws) {
          robot.bots.delete(role);
        }
      }

      // -----------------------------------------------
      // CAMERA DISCONNECTED
      // -----------------------------------------------

      if (connection.roles.has("CAMERA")) {
        for (const user of robot.users.values()) {
          const userConnection = connections.get(user.ws);

          if (!userConnection || userConnection.type !== "USER") {
            continue;
          }

          const roles = userConnection.roles.get(connection.robotId);

          if (!roles?.has("CAMERA")) {
            continue;
          }

          send(user.ws, {
            type: "camera:status",
            robotId: connection.robotId,
            connected: false,
          });
        }
      }

      // -----------------------------------------------
      // WATER_PUMP DISCONNECTED
      // -----------------------------------------------

      if (connection.roles.has("WATER_PUMP")) {
        for (const user of robot.users.values()) {
          const userConnection = connections.get(user.ws);

          if (!userConnection || userConnection.type !== "USER") {
            continue;
          }

          const roles = userConnection.roles.get(connection.robotId);

          if (!roles?.has("WATER_PUMP")) {
            continue;
          }

          send(user.ws, {
            type: "water:status",
            robotId: connection.robotId,
            connected: false,
          });
        }
      }

      // -----------------------------------------------
      // REMOVE ROBOT IF EMPTY
      // -----------------------------------------------

      removeRobotIfEmpty(connection.robotId);
    }
  }

  // ===================================================
  // USER CLEANUP
  // ===================================================

  if (connection.type === "USER") {
    for (const robotId of connection.robotIds) {
      const robot = robots.get(robotId);

      if (!robot) {
        continue;
      }

      const user = robot.users.get(connection.userId);

      if (user?.ws === ws) {
        robot.users.delete(connection.userId);
      }

      removeRobotIfEmpty(robotId);
    }
  }

  // ===================================================
  // REMOVE CONNECTION
  // ===================================================

  connections.delete(ws);

  console.log(`[WS CLEANUP] ${getConnectionLabel(ws)}`);
}
