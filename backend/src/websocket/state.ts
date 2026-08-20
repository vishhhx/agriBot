import { WebSocket } from "ws";

export type BotRole = "MOVEMENT_AND_OTHER" | "CAMERA" | "SERVO" | "WATER_PUMP";

export type UserConnection = {
  userId: string;
  robotId: string;
  ws: WebSocket;
};

export type BotConnection = {
  botId: string;
  robotId: string;
  role: BotRole;
  ws: WebSocket;
};

export type RobotConnection = {
  robotId: string;
  users: Map<string, UserConnection>;
  bots: Map<BotRole, BotConnection>;
};

export const robots = new Map<string, RobotConnection>();
export function getOrCreateRobot(robotId: string): RobotConnection {
  let robot = robots.get(robotId);
  if (!robot) {
    robot = {
      robotId,
      users: new Map(),
      bots: new Map(),
    };
    robots.set(robotId, robot);
  }
  return robot;
}

export function removeRobotIfEmpty(robotId: string) {
  const robot = robots.get(robotId);
  if (!robot) return;
  if (robot.users.size === 0 && robot.bots.size === 0) {
    robots.delete(robotId);
  }
}
