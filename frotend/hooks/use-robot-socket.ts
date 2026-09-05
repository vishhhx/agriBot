"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { robotSocket } from "@/lib/robot-socket";
import type {
  BotRole,
  CameraServoCommand,
  MovementDirection,
  RobotStatus,
  SprayCommand,
  WaterPumpState,
} from "@/lib/robot-events";

export type Telemetry = {
  battery?: number;
  speed?: number;
  rpm?: number;
  temperature?: number;
  latitude?: number;
  longitude?: number;
};

const DEFAULT_ROLES: BotRole[] = ["MOVEMENT_AND_OTHER"];

export function useRobotSocket(
  robotId: string,
  roles: BotRole[] = DEFAULT_ROLES,
) {
  const [connected, setConnected] = useState(robotSocket.connected);
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [cameraFrame, setCameraFrame] = useState<string | null>(null);
  const prevFrameUrl = useRef<string | null>(null);

  // ESP Role status state
  const [movementConnected, setMovementConnected] = useState(false);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [servoConnected, setServoConnected] = useState(false);
  const [sprayOn, setSprayOn] = useState(false);

  // Water pump state
  const [waterPumpConnected, setWaterPumpConnected] = useState(false);
  const [refillOn, setRefillOn] = useState(false);
  const [waterSprayOn, setWaterSprayOn] = useState(false);
  const [tankFull, setTankFull] = useState(false);
  const [waterDistanceCm, setWaterDistanceCm] = useState<number | null>(null);
  const [waterPercent, setWaterPercent] = useState<number | null>(null);
  const [sensorPresent, setSensorPresent] = useState<boolean>(true);

  const rolesKey = useMemo(() => roles.join("|"), [roles]);

  useEffect(() => {
    console.log("[useRobotSocket] mount robotId=", robotId, "roles=", rolesKey);

    robotSocket.connect();

    const removeConnectionListener = robotSocket.onConnectionChange(
      (isConnected) => {
        console.log("[useRobotSocket] connection change:", isConnected);
        setConnected(isConnected);
      },
    );

    const removeEventListener = robotSocket.on((event) => {
      console.log("[useRobotSocket] server event:", event.type, event);

      switch (event.type) {
        case "robot:status":
          if (event.robotId === robotId) {
            setStatus(event.status);
            setMovementConnected(event.status === "online");
          }
          break;

        case "movement:status":
          if (event.robotId === robotId) {
            setMovementConnected(event.connected);
          }
          break;

        case "robot:telemetry":
          if (event.robotId === robotId) setTelemetry(event.payload);
          break;

        case "camera:status":
          if (event.robotId === robotId) setCameraConnected(event.connected);
          break;

        case "servo:status":
          if (event.robotId === robotId) setServoConnected(event.connected);
          break;

        case "robot:command:accepted":
          console.log("[FRONTEND WS IN] Command accepted:", event);
          break;

        case "robot:command:rejected":
          console.warn(
            "[FRONTEND WS IN] Command rejected:",
            event.reason,
            event,
          );
          break;

        case "servo:event":
          if (event.robotId === robotId) {
            if (event.event === "SPRAY_ON") setSprayOn(true);
            if (event.event === "SPRAY_OFF") setSprayOn(false);
          }
          break;

        case "servo:accepted":
          if (event.robotId === robotId) setServoConnected(true);
          console.log("[useRobotSocket] servo:accepted", event);
          break;

        case "servo:rejected":
          console.warn("[useRobotSocket] servo:rejected", event);
          break;

        // -------------------------------------------
        // WATER PUMP
        // -------------------------------------------

        case "water:status":
          if (event.robotId === robotId) {
            setWaterPumpConnected(event.connected);
            if (!event.connected) {
              // Safety: clear pump state when module disconnects
              setRefillOn(false);
              setWaterSprayOn(false);
            }
          }
          break;

        case "water:event":
          if (event.robotId === robotId) {
            setRefillOn(event.refillPump);
            setWaterSprayOn(event.sprayPump);
            setTankFull(event.tankFull);
            setWaterDistanceCm(event.waterDistanceCm);
            if (event.waterPercent !== undefined)
              setWaterPercent(event.waterPercent);
            if (event.sensorPresent !== undefined)
              setSensorPresent(event.sensorPresent);
            console.log(
              `[useRobotSocket] water:event event=${event.event}`,
              `refill=${event.refillPump}`,
              `spray=${event.sprayPump}`,
              `tankFull=${event.tankFull}`,
              `dist=${event.waterDistanceCm}cm`,
              `percent=${event.waterPercent}%`,
              `sensorPresent=${event.sensorPresent}`,
            );
          }
          break;

        case "water:accepted":
          if (event.robotId === robotId) {
            if (event.command === "REFILL") {
              setRefillOn(event.state === "ON");
            } else if (event.command === "SPRAY") {
              setWaterSprayOn(event.state === "ON");
            }
          }
          console.log("[useRobotSocket] water:accepted", event);
          break;

        case "water:rejected":
          console.warn("[useRobotSocket] water:rejected", event.reason, event);
          break;

        default:
          break;
      }
    });

    // Binary JPEG frames
    const removeBinaryListener = robotSocket.onBinaryFrame((blob) => {
      const url = URL.createObjectURL(blob);
      setCameraFrame(url);
      if (prevFrameUrl.current) URL.revokeObjectURL(prevFrameUrl.current);
      prevFrameUrl.current = url;
    });

    console.log(
      "[useRobotSocket] subscribing robotId=",
      robotId,
      "roles=",
      rolesKey.split("|"),
    );
    robotSocket.subscribe(robotId, rolesKey.split("|") as BotRole[]);

    return () => {
      removeConnectionListener();
      removeEventListener();
      removeBinaryListener();
      robotSocket.unsubscribe(robotId);

      // Cleanup any lingering blob URL.
      if (prevFrameUrl.current) {
        URL.revokeObjectURL(prevFrameUrl.current);
        prevFrameUrl.current = null;
      }
    };
  }, [robotId, rolesKey]);

  // -------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------

  const sendMovement = useCallback(
    (command: MovementDirection, speed = 100) => {
      const wsState = robotSocket.socketReadyState;

      if (wsState === null || wsState !== WebSocket.OPEN) {
        console.error("[FRONTEND MOVEMENT ERROR] WebSocket not open");
        return false;
      }

      const requestId = crypto.randomUUID();

      console.log(
        `[FRONTEND MOVEMENT]\n` +
          `robot=${robotId}\n` +
          `role=MOVEMENT_AND_OTHER\n` +
          `command=${command}\n` +
          `speed=${speed}\n` +
          `requestId=${requestId}`,
      );

      const message = {
        type: "robot:movement" as const,
        robotId,
        role: "MOVEMENT_AND_OTHER" as const,
        command,
        speed,
        requestId,
      };

      console.log("[FRONTEND WS OUT]", JSON.stringify(message));

      const sent = robotSocket.sendMovement(message);

      if (sent) {
        console.log("[FRONTEND WS SENT]");
      } else {
        console.error(
          "[FRONTEND MOVEMENT ERROR] Failed to send WebSocket message",
        );
      }

      return sent;
    },
    [robotId],
  );

  const sendServoCamera = useCallback(
    (command: CameraServoCommand, angle?: number) => {
      console.log("[SERVO] Requested:", command);

      const wsState = robotSocket.socketReadyState;

      if (wsState === null) {
        console.error("[SERVO] WebSocket object does not exist");
        return;
      }

      if (wsState !== WebSocket.OPEN) {
        console.error("[SERVO] WebSocket is not OPEN, readyState=", wsState);
        return;
      }

      const message = {
        type: "servo:camera" as const,
        robotId,
        command,
        angle,
        requestId: crypto.randomUUID(),
      };

      console.log("[WS OUT][SERVO]", message);

      const serialized = JSON.stringify(message);
      console.log("[WS OUT][SERVO RAW]", serialized);

      const sent = robotSocket.sendServoCameraCommand(message);
      console.log("[WS OUT][SERVO] SENT result=", sent);
    },
    [robotId],
  );

  const sendSpray = useCallback(
    (command: SprayCommand) => {
      console.log("[SPRAY] Requested:", command);

      const wsState = robotSocket.socketReadyState;

      if (wsState === null) {
        console.error("[SPRAY] WebSocket object does not exist");
        return;
      }

      if (wsState !== WebSocket.OPEN) {
        console.error("[SPRAY] WebSocket is not OPEN, readyState=", wsState);
        return;
      }

      const message = {
        type: "servo:spray" as const,
        robotId,
        command,
        requestId: crypto.randomUUID(),
      };

      console.log("[WS OUT][SPRAY]", message);

      const serialized = JSON.stringify(message);
      console.log("[WS OUT][SPRAY RAW]", serialized);

      const sent = robotSocket.sendServoSprayCommand(message);
      console.log("[WS OUT][SPRAY] SENT result=", sent);
    },
    [robotId],
  );

  const sendWaterRefill = useCallback(
    (state: WaterPumpState) => {
      console.log("[WATER REFILL] Requested:", state);

      const wsState = robotSocket.socketReadyState;

      if (wsState === null) {
        console.error("[WATER REFILL] WebSocket object does not exist");
        return;
      }

      if (wsState !== WebSocket.OPEN) {
        console.error(
          "[WATER REFILL] WebSocket is not OPEN, readyState=",
          wsState,
        );
        return;
      }

      const message = {
        type: "water:refill" as const,
        robotId,
        state,
        requestId: crypto.randomUUID(),
      };

      console.log("[WS OUT][WATER REFILL]", message);
      const sent = robotSocket.sendWaterRefillCommand(message);
      console.log("[WS OUT][WATER REFILL] SENT result=", sent);
    },
    [robotId],
  );

  const sendWaterSpray = useCallback(
    (state: WaterPumpState) => {
      const wsState = robotSocket.socketReadyState;
      if (wsState === null || wsState !== WebSocket.OPEN) return;
      const message = {
        type: "water:spray" as const,
        robotId,
        state,
        requestId: crypto.randomUUID(),
      };
      robotSocket.sendWaterSprayCommand(message);
    },
    [robotId],
  );

  const sendHorn = useCallback(
    (beeps = 1) => {
      const wsState = robotSocket.socketReadyState;
      if (wsState === null || wsState !== WebSocket.OPEN) return;
      robotSocket.sendHornCommand({
        type: "horn:beep",
        robotId,
        beeps,
        requestId: crypto.randomUUID(),
      });
      console.log("[HORN] beeps=", beeps);
    },
    [robotId],
  );

  const espRoles = useMemo(
    () => ({
      MOVEMENT_AND_OTHER: movementConnected,
      WATER_PUMP: waterPumpConnected,
      CAMERA: cameraConnected,
      SERVO: servoConnected,
    }),
    [movementConnected, waterPumpConnected, cameraConnected, servoConnected],
  );

  return {
    connected,
    status,
    telemetry,
    espRoles,
    movementConnected,
    cameraConnected,
    cameraFrame,
    servoConnected,
    sprayOn,
    sendMovement,
    sendServoCamera,
    sendSpray,
    // Water pump
    waterPumpConnected,
    refillOn,
    waterSprayOn,
    tankFull,
    waterDistanceCm,
    waterPercent,
    sensorPresent,
    sendWaterRefill,
    sendWaterSpray,
    // Horn
    sendHorn,
  };
}
