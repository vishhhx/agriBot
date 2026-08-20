import { WebSocket } from "ws";

import { connections } from "../connections";
import { robots } from "../state";
import { send } from "../connections";
import { type Message } from "../types";

// =====================================================
// WATER: REFILL COMMAND  (User → Backend → ESP32)
// =====================================================

export function handleWaterRefillCommand(
  ws: WebSocket,
  message: Extract<Message, { type: "water:refill" }>,
) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // USER CHECK
  // ---------------------------------------------------

  if (!connection || connection.type !== "USER") {
    send(ws, {
      type: "ERROR",
      message: "Only users can control the water pump",
    });
    return;
  }

  // ---------------------------------------------------
  // ROBOT SUBSCRIPTION
  // ---------------------------------------------------

  if (!connection.robotIds.has(message.robotId)) {
    const reason = "Robot subscription is required";
    console.warn(
      `[WATER REFILL REJECTED] reason=${reason} user=${connection.userId} robot=${message.robotId}`,
    );
    send(ws, {
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason,
    });
    return;
  }

  // ---------------------------------------------------
  // WATER_PUMP ROLE
  // ---------------------------------------------------

  const roles = connection.roles.get(message.robotId);

  if (!roles?.has("WATER_PUMP")) {
    const reason = "WATER_PUMP role is not subscribed";
    console.warn(
      `[WATER REFILL REJECTED] reason=${reason} user=${connection.userId} robot=${message.robotId} storedRoles=${roles ? [...roles].join(",") : "none"}`,
    );
    send(ws, {
      type: "water:rejected",
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
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Robot not found",
    });
    return;
  }

  // ---------------------------------------------------
  // GET WATER_PUMP MODULE
  // ---------------------------------------------------

  const waterBot = robot.bots.get("WATER_PUMP");

  if (!waterBot) {
    const reason = "Water pump module is not connected";
    console.warn(
      `[WATER REFILL REJECTED] reason=${reason} robot=${message.robotId} bots=${[...robot.bots.keys()].join(",") || "none"}`,
    );
    send(ws, {
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason,
    });
    return;
  }

  // ---------------------------------------------------
  // VALIDATE STATE
  // ---------------------------------------------------

  if (message.state !== "ON" && message.state !== "OFF") {
    send(ws, {
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Invalid refill state (must be ON or OFF)",
    });
    return;
  }

  // ---------------------------------------------------
  // FORWARD COMMAND TO ESP32
  // ---------------------------------------------------

  send(waterBot.ws, {
    type: "COMMAND",
    data: {
      robotId: message.robotId,
      command: "REFILL",
      state: message.state,
      userId: connection.userId,
      requestId: message.requestId,
    },
  });

  // ---------------------------------------------------
  // ACK USER
  // ---------------------------------------------------

  send(ws, {
    type: "water:accepted",
    robotId: message.robotId,
    command: "REFILL",
    state: message.state,
    requestId: message.requestId,
  });

  console.log(
    `[WATER REFILL] user=${connection.userId} robot=${message.robotId} state=${message.state}`,
  );
}

// =====================================================
// WATER: SPRAY COMMAND  (User → Backend → ESP32)
// =====================================================

export function handleWaterSprayCommand(
  ws: WebSocket,
  message: Extract<Message, { type: "water:spray" }>,
) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // USER CHECK
  // ---------------------------------------------------

  if (!connection || connection.type !== "USER") {
    send(ws, {
      type: "ERROR",
      message: "Only users can control the spray pump",
    });
    return;
  }

  // ---------------------------------------------------
  // ROBOT SUBSCRIPTION
  // ---------------------------------------------------

  if (!connection.robotIds.has(message.robotId)) {
    send(ws, {
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Robot subscription is required",
    });
    return;
  }

  // ---------------------------------------------------
  // WATER_PUMP ROLE
  // ---------------------------------------------------

  const roles = connection.roles.get(message.robotId);

  if (!roles?.has("WATER_PUMP")) {
    send(ws, {
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "WATER_PUMP role is not subscribed",
    });
    return;
  }

  // ---------------------------------------------------
  // GET ROBOT
  // ---------------------------------------------------

  const robot = robots.get(message.robotId);

  if (!robot) {
    send(ws, {
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason: "Robot not found",
    });
    return;
  }

  // ---------------------------------------------------
  // GET WATER_PUMP MODULE
  // ---------------------------------------------------

  const waterBot = robot.bots.get("WATER_PUMP");

  if (!waterBot) {
    const reason = "Water pump module is not connected";
    console.warn(
      `[WATER SPRAY REJECTED] reason=${reason} robot=${message.robotId} bots=${[...robot.bots.keys()].join(",") || "none"}`,
    );
    send(ws, {
      type: "water:rejected",
      robotId: message.robotId,
      requestId: message.requestId,
      reason,
    });
    return;
  }

  // ---------------------------------------------------
  // FORWARD COMMAND TO ESP32
  // ---------------------------------------------------

  send(waterBot.ws, {
    type: "COMMAND",
    data: {
      robotId: message.robotId,
      command: "SPRAY",
      state: message.state,
      userId: connection.userId,
      requestId: message.requestId,
    },
  });

  // ---------------------------------------------------
  // ACK USER
  // ---------------------------------------------------

  send(ws, {
    type: "water:accepted",
    robotId: message.robotId,
    command: "SPRAY",
    state: message.state,
    requestId: message.requestId,
  });

  console.log(
    `[WATER SPRAY] user=${connection.userId} robot=${message.robotId} state=${message.state}`,
  );
}

// =====================================================
// WATER EVENT FROM ESP32  (ESP32 → Backend → Users)
// =====================================================

export function handleWaterEvent(
  ws: WebSocket,
  message: Extract<Message, { type: "water:event" }>,
) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // MUST BE WATER_PUMP BOT
  // ---------------------------------------------------

  if (!connection || connection.type !== "BOT") {
    send(ws, {
      type: "ERROR",
      message: "Only the water pump module can send water events",
    });
    return;
  }

  // ---------------------------------------------------
  // ROLE CHECK
  // ---------------------------------------------------

  if (!connection.roles.has("WATER_PUMP")) {
    send(ws, {
      type: "ERROR",
      message: "Invalid water pump module",
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
  // FORWARD EVENT TO SUBSCRIBED USERS
  // ---------------------------------------------------

  for (const user of robot.users.values()) {
    const userConnection = connections.get(user.ws);

    if (!userConnection || userConnection.type !== "USER") {
      continue;
    }

    const userRoles = userConnection.roles.get(message.robotId);

    if (!userRoles?.has("WATER_PUMP")) {
      continue;
    }

    send(user.ws, {
      type: "water:event",
      robotId: message.robotId,
      event: message.event,
      refillPump: message.refillPump,
      sprayPump: message.sprayPump,
      tankFull: message.tankFull,
      waterDistanceCm: message.waterDistanceCm,
    });
  }

  console.log(
    `[WATER EVENT] robot=${message.robotId} event=${message.event} refill=${message.refillPump} spray=${message.sprayPump} tankFull=${message.tankFull} dist=${message.waterDistanceCm}cm`,
  );

  // ---------------------------------------------------
  // ALSO NOTIFY MOVEMENT BOT (for OLED display)
  // ---------------------------------------------------

  const movementBot = robot.bots.get("MOVEMENT_AND_OTHER");

  if (movementBot && movementBot.ws.readyState === 1) {
    send(movementBot.ws, {
      type: "water:event",
      robotId: message.robotId,
      event: message.event,
      refillPump: message.refillPump,
      sprayPump: message.sprayPump,
      tankFull: message.tankFull,
      waterDistanceCm: message.waterDistanceCm,
    });
    console.log(`[WATER EVENT → MOVEMENT BOT] event=${message.event}`);
  }
}
