import { WebSocket } from "ws";
import bcrypt from "bcryptjs";
import { Robot } from "../../models/robot";
import { getOrCreateRobot, robots } from "../state";
import { connections, send } from "../connections";
import { broadcastRobotStatus } from "../broadcast";
import { type Message } from "../types";
import { botRoles, isBotRole } from "../roles";

// =====================================================
// ROBOT REGISTER
// =====================================================

export async function registerRobot(
  ws: WebSocket,
  message: Extract<
    Message,
    {
      type: "robot:register";
    }
  >,
) {
  console.log(`[ROBOT REGISTER STAGE 1] Received registration request from client: ${message.client}, robotId: ${message.robotId}`);

  // ---------------------------------------------------
  // VALIDATE CLIENT
  // ---------------------------------------------------

  if (message.client !== "robot") {
    console.warn(`[BOT AUTH FAILED] stage=1 reason=invalid-client client=${message.client}`);
    send(ws, {
      type: "ERROR",
      message: "Invalid robot client",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  // ---------------------------------------------------
  // VALIDATE CREDENTIALS
  // ---------------------------------------------------

  if (!message.robotId || !message.secret) {
    console.warn(`[BOT AUTH FAILED] stage=2 reason=missing-credentials robotId=${message.robotId}`);
    send(ws, {
      type: "ERROR",
      message: "robotId and secret are required",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  // ---------------------------------------------------
  // VALIDATE ROLES
  // ---------------------------------------------------

  const requestedRoles = Array.isArray(message.roles)
    ? message.roles.filter(isBotRole)
    : [];

  if (requestedRoles.length === 0) {
    console.warn(`[BOT AUTH FAILED] stage=3 reason=no-valid-roles robot=${message.robotId}`);
    send(ws, {
      type: "ERROR",
      message: "At least one valid bot role is required",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  const allowedRoles = requestedRoles;
  console.log(`[ROBOT REGISTER STAGE 2] Requested roles: ${allowedRoles.join(",")}. Querying database for robot record...`);

  // ---------------------------------------------------
  // FIND ROBOT
  // ---------------------------------------------------

  let robotRecord;
  try {
    robotRecord = await Robot.findOne({
      robotId: message.robotId,
    }).select("+robotSecretHash");
  } catch (dbErr) {
    console.error(`[BOT AUTH FAILED] stage=4 reason=db-error robot=${message.robotId}`, dbErr);
    send(ws, {
      type: "ERROR",
      message: "Database lookup failed",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  if (!robotRecord) {
    console.warn(
      `[BOT AUTH FAILED] stage=4 reason=not-found robot=${message.robotId}`,
    );

    send(ws, {
      type: "ERROR",
      message: "Robot not found",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  // ---------------------------------------------------
  // SECRET HASH
  // ---------------------------------------------------

  const secretHash = robotRecord.robotSecretHash;

  if (!secretHash) {
    console.error(
      `[BOT AUTH FAILED] stage=5 reason=no-secret-hash robot=${message.robotId}`,
    );

    send(ws, {
      type: "ERROR",
      message: "Robot authentication is not configured",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  console.log(`[ROBOT REGISTER STAGE 3] Secret hash found for robot ${message.robotId}. Verifying bcrypt secret...`);

  // ---------------------------------------------------
  // VERIFY SECRET
  // ---------------------------------------------------

  let validSecret = false;
  try {
    validSecret = await bcrypt.compare(message.secret, secretHash);
  } catch (bcryptErr) {
    console.error(`[BOT AUTH FAILED] stage=6 reason=bcrypt-error robot=${message.robotId}`, bcryptErr);
    send(ws, {
      type: "ERROR",
      message: "Credentials verification error",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  if (!validSecret) {
    console.warn(
      `[BOT AUTH FAILED] stage=6 reason=invalid-secret robot=${message.robotId}`,
    );

    send(ws, {
      type: "ERROR",
      message: "Invalid robot credentials",
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 100);

    return;
  }

  console.log(`[ROBOT REGISTER STAGE 4] Secret verified successfully. Accessing in-memory robot state...`);

  // ---------------------------------------------------
  // GET MEMORY ROBOT
  // ---------------------------------------------------

  const robot = getOrCreateRobot(message.robotId);

  // ---------------------------------------------------
  // REGISTER MODULES
  // ---------------------------------------------------

  for (const role of allowedRoles) {
    const existingBot = robot.bots.get(role);

    if (existingBot && existingBot.ws !== ws) {
      console.log(`[BOT] Replacing existing ${role} connection for robot ${message.robotId}`);

      try { existingBot.ws.close(); } catch {}
    }

    robot.bots.set(role, {
      botId: message.robotId,
      robotId: message.robotId,
      role,
      ws,
    });
  }

  // ---------------------------------------------------
  // MARK SOCKET AS BOT WITH ALL ROLES
  // ---------------------------------------------------

  const existingConn = connections.get(ws);
  if (existingConn && existingConn.type === "BOT") {
    for (const r of allowedRoles) {
      existingConn.roles.add(r);
    }
  } else {
    connections.set(ws, {
      type: "BOT",
      botId: message.robotId,
      robotId: message.robotId,
      roles: new Set(allowedRoles),
    });
  }

  console.log(`[ROBOT REGISTER STAGE 5] Connection registered in memory. Updating DB status to online...`);

  // ---------------------------------------------------
  // UPDATE DATABASE (Safely wrapped)
  // ---------------------------------------------------

  try {
    await Robot.updateOne(
      {
        robotId: message.robotId,
      },
      {
        $set: {
          status: "online",
        },
      },
    );
  } catch (updateErr) {
    console.error(`[ROBOT REGISTER WARN] Failed to update robot status in DB:`, updateErr);
  }

  // ---------------------------------------------------
  // SEND REGISTERED EVENT
  // ---------------------------------------------------

  console.log(`[ROBOT REGISTER STAGE 6] Sending robot:registered event to bot...`);

  send(ws, {
    type: "robot:registered",
    robotId: message.robotId,
    roles: allowedRoles,
  });

  console.log(
    `[BOT REGISTERED] ` +
      `robot=${message.robotId} ` +
      `roles=${allowedRoles.join(",")}`,
  );

  // ---------------------------------------------------
  // NOTIFY USERS
  // ---------------------------------------------------

  for (const user of robot.users.values()) {
    const userConnection = connections.get(user.ws);

    if (!userConnection || userConnection.type !== "USER") {
      continue;
    }

    const roles = userConnection.roles.get(message.robotId);

    send(user.ws, {
      type: "robot:connected",
      robotId: message.robotId,
    });

    if (allowedRoles.includes("MOVEMENT_AND_OTHER")) {
      send(user.ws, {
        type: "movement:status",
        robotId: message.robotId,
        connected: true,
      });
    }

    if (allowedRoles.includes("CAMERA")) {
      send(user.ws, {
        type: "camera:status",
        robotId: message.robotId,
        connected: true,
      });
    }

    if (allowedRoles.includes("WATER_PUMP")) {
      send(user.ws, {
        type: "water:status",
        robotId: message.robotId,
        connected: true,
      });
    }

    if (allowedRoles.includes("SERVO")) {
      send(user.ws, {
        type: "servo:status",
        robotId: message.robotId,
        connected: true,
      });
    }
  }

  // ---------------------------------------------------
  // BROADCAST ONLINE
  // ---------------------------------------------------

  broadcastRobotStatus(message.robotId, "online");
  console.log(`[ROBOT REGISTER STAGE 7] Registration completed successfully for robot=${message.robotId}`);
}

// =====================================================
// ROBOT TELEMETRY
// =====================================================

export async function handleRobotTelemetry(
  ws: WebSocket,
  message: Extract<
    Message,
    {
      type: "robot:telemetry";
    }
  >,
) {
  const connection = connections.get(ws);

  if (!connection || connection.type !== "BOT") {
    send(ws, {
      type: "ERROR",
      message: "Only registered bots can send telemetry",
    });

    return;
  }

  if (connection.robotId !== message.robotId) {
    send(ws, {
      type: "ERROR",
      message: "Invalid robot",
    });

    return;
  }

  if (
    !connection.roles.has("MOVEMENT_AND_OTHER") ||
    message.role !== "MOVEMENT_AND_OTHER"
  ) {
    send(ws, {
      type: "ERROR",
      message: "Invalid telemetry role",
    });

    return;
  }

  const robot = robots.get(message.robotId);

  if (!robot) {
    return;
  }

  console.log(
    `[ROBOT TELEMETRY] ` +
      `robot=${message.robotId} ` +
      `role=${message.role} ` +
      JSON.stringify(message.payload),
  );

  for (const user of robot.users.values()) {
    const userConnection = connections.get(user.ws);

    if (!userConnection || userConnection.type !== "USER") {
      continue;
    }

    const roles = userConnection.roles.get(message.robotId);

    if (!roles?.has("MOVEMENT_AND_OTHER")) {
      continue;
    }

    send(user.ws, {
      type: "robot:telemetry",
      robotId: message.robotId,
      role: "MOVEMENT_AND_OTHER",
      payload: message.payload,
    });
  }
}

// =====================================================
// ROBOT STATUS
// =====================================================

export async function handleRobotStatus(
  ws: WebSocket,
  message: Extract<
    Message,
    {
      type: "robot:status";
    }
  >,
) {
  const connection = connections.get(ws);

  if (!connection || connection.type !== "BOT") {
    send(ws, {
      type: "ERROR",
      message: "Only registered bots can send status",
    });

    return;
  }

  if (connection.robotId !== message.robotId) {
    send(ws, {
      type: "ERROR",
      message: "Invalid robot",
    });

    return;
  }

  // Allow any registered bot role to send status (e.g. SERVO, MOVEMENT_AND_OTHER)
  if (!message.role || !connection.roles.has(message.role)) {
    send(ws, {
      type: "ERROR",
      message: "Invalid status role",
    });

    return;
  }

  await Robot.updateOne(
    {
      robotId: message.robotId,
    },
    {
      $set: {
        status: message.status,
      },
    },
  );

  broadcastRobotStatus(message.robotId, message.status);

  console.log(
    `[ROBOT STATUS] ` +
      `robot=${message.robotId} ` +
      `status=${message.status}`,
  );
}
