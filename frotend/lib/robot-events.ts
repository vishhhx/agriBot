export type BotRole = "MOVEMENT_AND_OTHER" | "CAMERA" | "SERVO" | "WATER_PUMP";

export type MovementDirection = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";

export type RobotStatus = "online" | "offline" | "idle" | "busy" | "maintenance";

export type CameraServoCommand = "LEFT" | "RIGHT" | "UP" | "DOWN" | "CENTER";

export type SprayCommand = "ON" | "OFF";

export type WaterPumpState = "ON" | "OFF";

export type WaterEventName =
  | "REFILL_STARTED"
  | "REFILL_STOPPED"
  | "REFILL_AUTO_STOPPED"
  | "TANK_FULL"
  | "SPRAY_STARTED"
  | "SPRAY_STOPPED"
  | "ALL_PUMPS_STOPPED"
  | "SENSOR_DISCONNECTED";

// =====================================================
// CLIENT → BACKEND EVENTS
// =====================================================

export type MovementCommand = {
  type: "robot:movement";
  robotId: string;
  role: "MOVEMENT_AND_OTHER";
  command: MovementDirection;
  speed: number;
  requestId: string;
};

export type RobotSubscribeEvent = {
  type: "robot:subscribe";
  robotId: string;
  roles: BotRole[];
};

export type RobotUnsubscribeEvent = {
  type: "robot:unsubscribe";
  robotId: string;
};

export type ServoCameraCommand = {
  type: "servo:camera";
  robotId: string;
  command: CameraServoCommand;
  angle?: number;
  requestId?: string;
};

export type ServoSprayCommand = {
  type: "servo:spray";
  robotId: string;
  command: SprayCommand;
  requestId?: string;
};

export type WaterRefillCommand = {
  type: "water:refill";
  robotId: string;
  state: WaterPumpState;
  requestId?: string;
};

export type WaterSprayCommand = {
  type: "water:spray";
  robotId: string;
  state: WaterPumpState;
  requestId?: string;
};

export type HornBeepCommand = {
  type: "horn:beep";
  robotId: string;
  beeps?: number;
  requestId?: string;
};

// =====================================================
// BACKEND → CLIENT EVENTS
// =====================================================

export type RobotStatusEvent = {
  type: "robot:status";
  robotId: string;
  status: RobotStatus;
};

export type RobotConnectedEvent = { type: "robot:connected"; robotId: string };
export type RobotDisconnectedEvent = { type: "robot:disconnected"; robotId: string };

export type RobotTelemetryEvent = {
  type: "robot:telemetry";
  robotId: string;
  role: "MOVEMENT_AND_OTHER";
  payload: {
    battery?: number;
    speed?: number;
    temperature?: number;
    latitude?: number;
    longitude?: number;
  };
};

export type RobotCommandAcceptedEvent = {
  type: "robot:command:accepted";
  robotId: string;
  requestId: string;
};

export type RobotCommandRejectedEvent = {
  type: "robot:command:rejected";
  robotId: string;
  requestId?: string;
  reason: string;
};

export type RobotErrorEvent = {
  type: "robot:error";
  robotId: string;
  role?: BotRole;
  message: string;
};

export type CameraStatusEvent = {
  type: "camera:status";
  robotId: string;
  connected: boolean;
};

export type CameraEvent = {
  type: "camera:event";
  robotId: string;
  role: "CAMERA";
  event: "STREAM_STARTED" | "STREAM_STOPPED" | "CAMERA_READY" | "CAMERA_ERROR";
  payload?: unknown;
};

export type ServoAcceptedEvent = {
  type: "servo:accepted";
  robotId: string;
  command: string;
  angle?: number;
  requestId?: string;
};

export type ServoRejectedEvent = {
  type: "servo:rejected";
  robotId: string;
  requestId?: string;
  reason: string;
};

export type ServoEvent = {
  type: "servo:event";
  robotId: string;
  event: "READY" | "CAMERA_MOVED" | "SPRAY_ON" | "SPRAY_OFF" | "ERROR";
  payload?: unknown;
};

// =====================================================
// WATER PUMP  — BACKEND → CLIENT EVENTS
// =====================================================

export type WaterStatusEvent = {
  type: "water:status";
  robotId: string;
  connected: boolean;
};

export type WaterAcceptedEvent = {
  type: "water:accepted";
  robotId: string;
  command: "REFILL" | "SPRAY";
  state: WaterPumpState;
  requestId?: string;
};

export type WaterRejectedEvent = {
  type: "water:rejected";
  robotId: string;
  requestId?: string;
  reason: string;
};

export type WaterEvent = {
  type: "water:event";
  robotId: string;
  event: WaterEventName;
  refillPump: boolean;
  sprayPump: boolean;
  tankFull: boolean;
  waterDistanceCm: number;
  waterPercent?: number;
  sensorPresent?: boolean;
};

export type HornAcceptedEvent = {
  type: "horn:accepted";
  robotId: string;
};

export type MovementStatusEvent = {
  type: "movement:status";
  robotId: string;
  connected: boolean;
};

export type ServoStatusEvent = {
  type: "servo:status";
  robotId: string;
  connected: boolean;
};

export type RobotServerEvent =
  | RobotStatusEvent
  | RobotConnectedEvent
  | RobotDisconnectedEvent
  | RobotTelemetryEvent
  | RobotCommandAcceptedEvent
  | RobotCommandRejectedEvent
  | RobotErrorEvent
  | MovementStatusEvent
  | CameraStatusEvent
  | CameraEvent
  | ServoStatusEvent
  | ServoAcceptedEvent
  | ServoRejectedEvent
  | ServoEvent
  | WaterStatusEvent
  | WaterAcceptedEvent
  | WaterRejectedEvent
  | WaterEvent
  | HornAcceptedEvent;

export type RobotClientEvent =
  | RobotSubscribeEvent
  | RobotUnsubscribeEvent
  | MovementCommand
  | ServoCameraCommand
  | ServoSprayCommand
  | WaterRefillCommand
  | WaterSprayCommand
  | HornBeepCommand;
