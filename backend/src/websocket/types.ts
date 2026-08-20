import { type BotRole } from "./state";

// =====================================================
// SERVO TYPES
// =====================================================

export type CameraServoCommand = "LEFT" | "RIGHT" | "UP" | "DOWN" | "CENTER";

export type SprayCommand = "ON" | "OFF";

// =====================================================
// WATER PUMP TYPES
// =====================================================

export type WaterPumpState = "ON" | "OFF";

export type WaterEventName =
  | "REFILL_STARTED"
  | "REFILL_STOPPED"
  | "REFILL_AUTO_STOPPED"
  | "TANK_FULL"
  | "SPRAY_STARTED"
  | "SPRAY_STOPPED"
  | "ALL_PUMPS_STOPPED";

export type Message =

  | {
      type: "robot:register";
      client: "robot";
      robotId: string;
      secret: string;
      roles: BotRole[];
    }

  | {
      type: "robot:subscribe";
      robotId: string;
      roles: BotRole[];
    }

  | {
      type: "robot:unsubscribe";
      robotId: string;
    }


  | {
      type: "robot:movement";
      robotId: string;
      role: "MOVEMENT_AND_OTHER";
      command: "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";
      speed: number;
      requestId: string;
    }

  | {
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
    }


  | {
      type: "robot:status";
      robotId: string;
      role?: BotRole;
      status: "online" | "offline" | "idle" | "busy" | "maintenance";
    }

  | {
      type: "movement:status";
      robotId: string;
      connected: boolean;
    }

  | {
      type: "servo:status";
      robotId: string;
      connected: boolean;
    }


  | {
      type: "camera:event";
      robotId: string;
      role: "CAMERA";
      event:
        | "STREAM_STARTED"
        | "STREAM_STOPPED"
        | "CAMERA_READY"
        | "CAMERA_ERROR";
      payload?: unknown;
    }

  | {
      type: "BOT_COMMAND";
      data: {
        robotId: string;
        target: BotRole;
        payload: unknown;
      };
    }


  | {
      type: "BOT_EVENT";
      data: {
        robotId: string;
        payload: unknown;
      };
    }

  // ---------------------------------------------------
  // USER -> BACKEND
  // Camera servo movement
  // ---------------------------------------------------
  | {
      type: "servo:camera";
      robotId: string;
      command: CameraServoCommand;
      angle?: number;
      requestId?: string;
    }

  // ---------------------------------------------------
  // USER -> BACKEND
  // Spray control
  // ---------------------------------------------------
  | {
      type: "servo:spray";
      robotId: string;
      command: SprayCommand;
      requestId?: string;
    }

  // ---------------------------------------------------
  // SERVO -> BACKEND
  // Servo event
  // ---------------------------------------------------
  | {
      type: "servo:event";
      robotId: string;
      event:
        | "READY"
        | "CAMERA_MOVED"
        | "SPRAY_ON"
        | "SPRAY_OFF"
        | "ERROR";
      payload?: unknown;
    }

  // ---------------------------------------------------
  // USER -> BACKEND
  // Refill pump control
  // ---------------------------------------------------
  | {
      type: "water:refill";
      robotId: string;
      state: WaterPumpState;
      requestId?: string;
    }

  // ---------------------------------------------------
  // USER -> BACKEND
  // Spray pump control
  // ---------------------------------------------------
  | {
      type: "water:spray";
      robotId: string;
      state: WaterPumpState;
      requestId?: string;
    }

  // ---------------------------------------------------
  // ESP32 -> BACKEND
  // Water event telemetry
  // ---------------------------------------------------
  | {
      type: "water:event";
      robotId: string;
      event: WaterEventName;
      refillPump: boolean;
      sprayPump: boolean;
      tankFull: boolean;
      waterDistanceCm: number;
    }

  // ---------------------------------------------------
  // USER -> BACKEND
  // Horn beep
  // ---------------------------------------------------
  | {
      type: "horn:beep";
      robotId: string;
      beeps?: number;
      requestId?: string;
    };



export type ConnectionInfo =
  | {
      type: "USER";
      userId: string;
      robotIds: Set<string>;

      roles: Map<string, Set<BotRole>>;
    }
  | {
      type: "BOT";
      botId: string;
      robotId: string;
      roles: Set<BotRole>;
    };
