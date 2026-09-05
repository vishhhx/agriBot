import { WebSocket, type RawData } from "ws";
import { robots } from "../state";
import { connections, getConnectionLabel, send } from "../connections";
import { type Message } from "../types";

export function handleCameraStreamCommand(
  ws: WebSocket,
  message: Extract<Message, { type: "camera:stream" }>,
) {
  const connection = connections.get(ws);
  if (!connection || connection.type !== "USER") {
    send(ws, { type: "ERROR", message: "Only users can control the camera" });
    return;
  }

  if (!connection.robotIds.has(message.robotId)) {
    send(ws, { type: "ERROR", message: "Robot subscription required" });
    return;
  }

  if (!connection.roles.get(message.robotId)?.has("CAMERA")) {
    send(ws, { type: "ERROR", message: "Camera role subscription required" });
    return;
  }

  const robot = robots.get(message.robotId);
  const cameraBot = robot?.bots.get("CAMERA");
  if (!cameraBot) {
    send(ws, { type: "ERROR", message: "Camera module is not connected" });
    return;
  }

  send(cameraBot.ws, {
    type: "COMMAND",
    data: {
      robotId: message.robotId,
      command: "STREAM",
      state: message.state,
      userId: connection.userId,
      requestId: message.requestId,
    },
  });

  if (!robot) return;
  for (const user of robot.users.values()) {
    const userConnection = connections.get(user.ws);
    if (userConnection?.type !== "USER") continue;
    if (!userConnection.roles.get(message.robotId)?.has("CAMERA")) continue;

    send(user.ws, {
      type: "camera:stream",
      robotId: message.robotId,
      state: message.state,
      requestId: message.requestId,
    });
  }
}

// =====================================================
// CAMERA EVENT
// =====================================================

export async function handleCameraEvent(
  ws: WebSocket,
  message: Extract<
    Message,
    {
      type: "camera:event";
    }
  >,
) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // MUST BE REGISTERED CAMERA BOT
  // ---------------------------------------------------

  if (!connection || connection.type !== "BOT") {
    send(ws, {
      type: "ERROR",
      message: "Only registered bots can send camera events",
    });

    return;
  }

  // ---------------------------------------------------
  // ROLE CHECK
  // ---------------------------------------------------

  if (!connection.roles.has("CAMERA")) {
    send(ws, {
      type: "ERROR",
      message: "This connection is not a camera module",
    });

    return;
  }

  // ---------------------------------------------------
  // ROBOT ID CHECK
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

  console.log(
    `[CAMERA EVENT] ` + `robot=${message.robotId} ` + `event=${message.event}`,
  );

  // ---------------------------------------------------
  // FORWARD TO CAMERA VIEWERS
  // ---------------------------------------------------

  for (const user of robot.users.values()) {
    const userConnection = connections.get(user.ws);

    if (!userConnection || userConnection.type !== "USER") {
      continue;
    }

    const roles = userConnection.roles.get(message.robotId);

    if (!roles?.has("CAMERA")) {
      continue;
    }

    send(user.ws, {
      type: "camera:event",
      robotId: message.robotId,
      role: "CAMERA",
      event: message.event,
      payload: message.payload ?? null,
    });
  }
}

// =====================================================
// CAMERA FRAME
//
// IMPORTANT:
// This receives BINARY JPEG data.
//
// It does NOT parse JSON.
// =====================================================

export function handleCameraFrame(ws: WebSocket, rawMessage: RawData) {
  const connection = connections.get(ws);

  // ---------------------------------------------------
  // MUST BE CAMERA MODULE
  // ---------------------------------------------------

  if (
    !connection ||
    connection.type !== "BOT" ||
    !connection.roles.has("CAMERA")
  ) {
    console.warn(`[CAMERA FRAME REJECTED] ` + `${getConnectionLabel(ws)}`);

    return;
  }

  const robotId = connection.robotId;

  const robot = robots.get(robotId);

  if (!robot) {
    return;
  }

  // ---------------------------------------------------
  // CONVERT RAW DATA TO BUFFER
  // ---------------------------------------------------

  let frame: Buffer;

  if (Buffer.isBuffer(rawMessage)) {
    frame = rawMessage;
  } else if (rawMessage instanceof ArrayBuffer) {
    frame = Buffer.from(rawMessage);
  } else if (Array.isArray(rawMessage)) {
    frame = Buffer.concat(
      rawMessage.map((chunk) =>
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      ),
    );
  } else {
    console.warn(`[CAMERA FRAME] Unsupported data type ` + `robot=${robotId}`);

    return;
  }

  // ---------------------------------------------------
  // BASIC JPEG VALIDATION
  //
  // JPEG:
  // FF D8 ........ FF D9
  // ---------------------------------------------------

  if (
    frame.length < 4 ||
    frame[0] !== 0xff ||
    frame[1] !== 0xd8 ||
    frame[frame.length - 2] !== 0xff ||
    frame[frame.length - 1] !== 0xd9
  ) {
    console.warn(
      `[CAMERA FRAME] Invalid JPEG ` +
        `robot=${robotId} ` +
        `size=${frame.length}`,
    );

    return;
  }

  // ---------------------------------------------------
  // FORWARD FRAME TO USERS
  // ---------------------------------------------------

  let viewerCount = 0;

  for (const user of robot.users.values()) {
    const userConnection = connections.get(user.ws);

    if (!userConnection || userConnection.type !== "USER") {
      continue;
    }

    // -------------------------------------------------
    // USER MUST BE SUBSCRIBED TO CAMERA
    // -------------------------------------------------

    const roles = userConnection.roles.get(robotId);

    if (!roles?.has("CAMERA")) {
      continue;
    }

    // -------------------------------------------------
    // CHECK SOCKET
    // -------------------------------------------------

    if (user.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    // -------------------------------------------------
    // SEND BINARY JPEG
    // -------------------------------------------------

    user.ws.send(frame, {
      binary: true,
    });

    viewerCount++;
  }

  console.log(
    `[CAMERA FRAME] ` +
      `robot=${robotId} ` +
      `size=${frame.length} ` +
      `viewers=${viewerCount}`,
  );
}
