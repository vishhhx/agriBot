import { WebSocket } from "ws";
import { RobotConnection } from "../../models/robotConnection";
import { Robot } from "../../models/robot";
import User from "../../models/user";
import { type BotRole, getOrCreateRobot, robots } from "../state";
import { connections, send } from "../connections";
import { type Message } from "../types";

// =====================================================
// SUBSCRIBE USER TO ROBOT
// =====================================================

export async function subscribeUserToRobot(
  ws: WebSocket,
  userId: string,
  robotId: string,
  roles: BotRole[],
) {
  // ---------------------------------------------------
  // FIND USER
  // ---------------------------------------------------

  const user = await User.findOne({
    userId,
  }).select("_id");

  // ---------------------------------------------------
  // FIND ROBOT
  // ---------------------------------------------------

  const robotRecord = await Robot.findOne({
    robotId,
  }).select("_id status");

  if (!user || !robotRecord) {
    send(ws, {
      type: "ERROR",
      message: "Robot not found",
    });

    return;
  }

  // ---------------------------------------------------
  // CHECK VIEW ACCESS
  // ---------------------------------------------------

  const hasAccess = await RobotConnection.exists({
    userId: user._id,
    robotId: robotRecord._id,
    status: "active",
    "permissions.view": true,
  });

  if (!hasAccess) {
    send(ws, {
      type: "ERROR",
      message: "You do not have access to this robot",
    });

    return;
  }

  // ---------------------------------------------------
  // GET MEMORY ROBOT
  // ---------------------------------------------------

  const robot = getOrCreateRobot(robotId);

  // ---------------------------------------------------
  // REGISTER USER CONNECTION
  // ---------------------------------------------------

  robot.users.set(userId, {
    userId,
    robotId,
    ws,
  });

  // ---------------------------------------------------
  // REGISTER CONNECTION
  // ---------------------------------------------------

  const existing = connections.get(ws);

  if (existing?.type === "USER" && existing.userId === userId) {
    existing.robotIds.add(robotId);

    existing.roles.set(robotId, new Set(roles));
  } else {
    connections.set(ws, {
      type: "USER",

      userId,

      robotIds: new Set([robotId]),

      roles: new Map([[robotId, new Set(roles)]]),
    });
  }

  // ---------------------------------------------------
  // CURRENT STATUS
  // ---------------------------------------------------

  const status = robot.bots.size > 0 ? "online" : robotRecord.status;

  console.log(
    `[WS SUBSCRIBE] ` +
      `user=${userId} ` +
      `robot=${robotId} ` +
      `roles=${roles.join(",")}`,
  );

  // ---------------------------------------------------
  // ROBOT CONNECTED
  // ---------------------------------------------------

  if (robot.bots.size > 0) {
    send(ws, {
      type: "robot:connected",
      robotId,
    });
  }

  // ---------------------------------------------------
  // STATUS FOR ALL 4 ROLES
  // ---------------------------------------------------

  send(ws, {
    type: "robot:status",
    robotId,
    status,
  });

  const movementBot = robot.bots.get("MOVEMENT_AND_OTHER");
  send(ws, {
    type: "movement:status",
    robotId,
    connected: Boolean(movementBot),
  });

  const cameraBot = robot.bots.get("CAMERA");
  send(ws, {
    type: "camera:status",
    robotId,
    connected: Boolean(cameraBot),
  });

  const waterBot = robot.bots.get("WATER_PUMP");
  send(ws, {
    type: "water:status",
    robotId,
    connected: Boolean(waterBot),
  });

  const servoBot = robot.bots.get("SERVO");
  send(ws, {
    type: "servo:status",
    robotId,
    connected: Boolean(servoBot),
  });
}
