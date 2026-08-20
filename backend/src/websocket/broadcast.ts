import { WebSocket } from "ws";
import { robots } from "./state";
import { send } from "./connections";

// =====================================================
// BROADCAST ROBOT STATUS
// =====================================================

export function broadcastRobotStatus(robotId: string, status: string) {
  const robot = robots.get(robotId);

  if (!robot) {
    return;
  }

  for (const user of robot.users.values()) {
    send(user.ws, {
      type: "robot:status",
      robotId,
      status,
    });
  }
}

// =====================================================
// BROADCAST ROBOT DISCONNECTED
// =====================================================

export function broadcastRobotDisconnected(robotId: string) {
  const robot = robots.get(robotId);

  if (!robot) {
    return;
  }

  for (const user of robot.users.values()) {
    send(user.ws, {
      type: "robot:disconnected",
      robotId,
    });
  }
}
