import { WebSocket } from "ws";
import { type ConnectionInfo } from "./types";

// =====================================================
// ACTIVE WEBSOCKET CONNECTIONS
// =====================================================

export const connections = new Map<WebSocket, ConnectionInfo>();

// =====================================================
// EVENT DETAILS
// =====================================================

export const getEventDetails = (data: unknown) => {
  if (!data || typeof data !== "object") {
    return {
      type: "unknown",
      robotId: "-",
    };
  }

  const event = data as {
    type?: unknown;
    robotId?: unknown;
    data?: {
      robotId?: unknown;
    };
  };

  return {
    type: typeof event.type === "string" ? event.type : "unknown",

    robotId:
      typeof event.robotId === "string"
        ? event.robotId
        : typeof event.data?.robotId === "string"
          ? event.data.robotId
          : "-",
  };
};

// =====================================================
// CONNECTION LABEL
// =====================================================

export const getConnectionLabel = (ws: WebSocket) => {
  const connection = connections.get(ws);

  if (!connection) {
    return "client=unauthenticated";
  }

  if (connection.type === "USER") {
    return `user=${connection.userId}`;
  }

  return `bot=${connection.botId} ` + `roles=${Array.from(connection.roles).join(",")}`;
};

// =====================================================
// SEND JSON
// =====================================================

export function send(ws: WebSocket, data: unknown) {
  if (ws.readyState !== WebSocket.OPEN) {
    const event = getEventDetails(data);

    console.warn(
      `[WS OUT SKIPPED] ` +
        `${getConnectionLabel(ws)} ` +
        `event=${event.type} ` +
        `robot=${event.robotId}`,
    );

    return;
  }

  const event = getEventDetails(data);

  console.log(
    `[WS OUT] ` +
      `${getConnectionLabel(ws)} ` +
      `event=${event.type} ` +
      `robot=${event.robotId}`,
  );

  ws.send(JSON.stringify(data));
}
