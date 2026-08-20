import { WebSocket } from "ws";

import { connections } from "../connections";
import { robots } from "../state";
import { send } from "../connections";
import { type Message, type CameraServoCommand, type SprayCommand } from "../types";

// =====================================================
// CAMERA SERVO COMMAND
// =====================================================

export function handleCameraServoCommand(
  ws: WebSocket,
  message: Extract<Message, { type: "servo:camera" }>,
) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // USER CHECK
  // ---------------------------------------------------

  if (!connection || connection.type !== "USER") {
    send(ws, {
      type: "ERROR",
      message: "Only users can control the servo",
    });

    return;
  }

  // ---------------------------------------------------
  // ROBOT SUBSCRIPTION
  // ---------------------------------------------------

  if (!connection.robotIds.has(message.robotId)) {
    const reason = "Robot subscription is required";
    console.warn(`[SERVO REJECTED] reason=${reason} user=${connection.userId} robot=${message.robotId}`);
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason,
    });

    return;
  }

  // ---------------------------------------------------
  // SERVO ROLE
  // ---------------------------------------------------

  const roles = connection.roles.get(message.robotId);

  if (!roles?.has("SERVO")) {
    const reason = "SERVO role is not subscribed";
    console.warn(`[SERVO REJECTED] reason=${reason} user=${connection.userId} robot=${message.robotId} storedRoles=${roles ? [...roles].join(",") : "none"}`);
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason,
    });

    return;
  }

  // ---------------------------------------------------
  // GET ROBOT
  // ---------------------------------------------------

  const robot = robots.get(message.robotId);

  if (!robot) {
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Robot not found",
    });

    return;
  }

  // ---------------------------------------------------
  // GET SERVO MODULE
  // ---------------------------------------------------

  const servoBot = robot.bots.get("SERVO");

  if (!servoBot) {
    const reason = "Servo module is not connected";
    console.warn(`[SERVO REJECTED] reason=${reason} robot=${message.robotId} bots=${[...robot.bots.keys()].join(",")||"none"}`);
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason,
    });

    return;
  }

  // ---------------------------------------------------
  // VALIDATE ANGLE
  // ---------------------------------------------------

  if (
    message.angle !== undefined &&
    (!Number.isFinite(message.angle) ||
      message.angle < 0 ||
      message.angle > 180)
  ) {
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Servo angle must be between 0 and 180",
    });

    return;
  }

  // ---------------------------------------------------
  // SEND COMMAND TO ESP32
  // ---------------------------------------------------

  send(servoBot.ws, {
    type: "COMMAND",

    data: {
      robotId: message.robotId,

      target: "SERVO",

      command: message.command,

      angle: message.angle,

      userId: connection.userId,

      requestId: message.requestId,
    },
  });

  // ---------------------------------------------------
  // ACK USER
  // ---------------------------------------------------

  send(ws, {
    type: "servo:accepted",

    robotId: message.robotId,

    command: message.command,

    angle: message.angle,

    requestId: message.requestId,
  });

  console.log(
    `[SERVO CAMERA] ` +
      `user=${connection.userId} ` +
      `robot=${message.robotId} ` +
      `command=${message.command} ` +
      `angle=${message.angle ?? "-"}`,
  );
}

// =====================================================
// SPRAY SERVO COMMAND
// =====================================================

export function handleSprayServoCommand(
  ws: WebSocket,
  message: Extract<Message, { type: "servo:spray" }>,
) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // USER CHECK
  // ---------------------------------------------------

  if (!connection || connection.type !== "USER") {
    send(ws, {
      type: "ERROR",
      message: "Only users can control the spray",
    });

    return;
  }

  // ---------------------------------------------------
  // ROBOT SUBSCRIPTION
  // ---------------------------------------------------

  if (!connection.robotIds.has(message.robotId)) {
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Robot subscription is required",
    });

    return;
  }

  // ---------------------------------------------------
  // SERVO ROLE
  // ---------------------------------------------------

  const roles = connection.roles.get(message.robotId);

  if (!roles?.has("SERVO")) {
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "SERVO role is not subscribed",
    });

    return;
  }

  // ---------------------------------------------------
  // GET ROBOT
  // ---------------------------------------------------

  const robot = robots.get(message.robotId);

  if (!robot) {
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Robot not found",
    });

    return;
  }

  // ---------------------------------------------------
  // GET SERVO MODULE
  // ---------------------------------------------------

  const servoBot = robot.bots.get("SERVO");

  if (!servoBot) {
    const reason = "Servo module is not connected";
    console.warn(`[SPRAY REJECTED] reason=${reason} robot=${message.robotId} bots=${[...robot.bots.keys()].join(",")||"none"}`);
    send(ws, {
      type: "servo:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason,
    });

    return;
  }

  // ---------------------------------------------------
  // SEND SPRAY COMMAND
  //
  // BOTH SPRAY SERVOS ARE CONTROLLED TOGETHER
  // ---------------------------------------------------

  send(servoBot.ws, {
    type: "COMMAND",

    data: {
      robotId: message.robotId,

      target: "SERVO",

      command: "SPRAY",

      state: message.command,

      userId: connection.userId,

      requestId: message.requestId,
    },
  });

  // ---------------------------------------------------
  // ACK USER
  // ---------------------------------------------------

  send(ws, {
    type: "servo:accepted",

    robotId: message.robotId,

    command: message.command,

    requestId: message.requestId,
  });

  console.log(
    `[SPRAY] ` +
      `user=${connection.userId} ` +
      `robot=${message.robotId} ` +
      `state=${message.command}`,
  );
}

// =====================================================
// SERVO EVENT FROM ESP32
// =====================================================

export function handleServoEvent(
  ws: WebSocket,
  message: Extract<Message, { type: "servo:event" }>,
) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // MUST BE SERVO BOT
  // ---------------------------------------------------

  if (!connection || connection.type !== "BOT") {
    send(ws, {
      type: "ERROR",
      message: "Only servo module can send servo events",
    });

    return;
  }

  // ---------------------------------------------------
  // ROLE CHECK
  // ---------------------------------------------------

  if (!connection.roles.has("SERVO")) {
    send(ws, {
      type: "ERROR",
      message: "Invalid servo module",
    });

    return;
  }

  // ---------------------------------------------------
  // ROBOT CHECK
  // ---------------------------------------------------

  if (connection.robotId !== message.robotId) {
    send(ws, {
      type: "ERROR",
      message: "Invalid robot",
    });

    return;
  }

  const robot = robots.get(message.robotId);

  if (!robot) {
    return;
  }

  // ---------------------------------------------------
  // FORWARD EVENT TO USERS
  // ---------------------------------------------------

  for (const user of robot.users.values()) {
    const userConnection = connections.get(user.ws);

    if (!userConnection || userConnection.type !== "USER") {
      continue;
    }

    const roles = userConnection.roles.get(message.robotId);

    if (!roles?.has("SERVO")) {
      continue;
    }

    send(user.ws, {
      type: "servo:event",

      robotId: message.robotId,

      event: message.event,

      payload: message.payload ?? null,
    });
  }

  console.log(
    `[SERVO EVENT] ` + `robot=${message.robotId} ` + `event=${message.event}`,
  );
}
