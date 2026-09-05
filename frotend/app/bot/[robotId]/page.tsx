"use client";

import { isAxiosError } from "axios";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Battery,
  BotIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cpu,
  Crosshair,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  Maximize2,
  Minimize2,
  Radio,
  RotateCcw,
  Shield,
  Signal,
  Square,
  Thermometer,
  Video,
  VideoOff,
  Volume2,
  Waves,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRobotSocket } from "@/hooks/use-robot-socket";
import { WaterPumpController } from "@/components/robot/water-pump-controller";
import { axiosInstance } from "@/utils/axios";

import type {
  CameraServoCommand,
  MovementDirection,
  SprayCommand,
} from "@/lib/robot-events";

// =====================================================
// TYPES
// =====================================================

type BotStatus = "online" | "offline" | "idle" | "busy" | "maintenance";

interface BotDetails {
  robotId: string;
  name: string;

  model: {
    name: string;
    version: string;
    manufacturer: string;
  };

  firmwareVersion: string;

  status: BotStatus;

  role: "owner" | "operator" | "viewer" | "technician";
}

const STATUS_COLOR: Record<BotStatus, string> = {
  online: "text-emerald-600",
  offline: "text-slate-400",
  idle: "text-sky-600",
  busy: "text-amber-600",
  maintenance: "text-rose-600",
};

const STATUS_DOT: Record<BotStatus, string> = {
  online: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
  offline: "bg-slate-300",
  idle: "bg-sky-400",
  busy: "bg-amber-400",
  maintenance: "bg-rose-400",
};

const isBotStatus = (value: unknown): value is BotStatus =>
  typeof value === "string" && value in STATUS_DOT;

// =====================================================
// CAMERA BACKGROUND
// =====================================================

function CameraBg({
  frame,
  cameraConnected,
  streamEnabled = true,
}: {
  frame: string | null;
  cameraConnected: boolean;
  streamEnabled?: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-slate-100">
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frame}
          alt="Live camera feed"
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-100 via-emerald-50/20 to-sky-50/30">
          {!streamEnabled ? (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl shadow-slate-200/80 border border-slate-200/80">
                <VideoOff size={36} className="text-slate-400" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                Camera Stream Off
              </p>
            </>
          ) : cameraConnected ? (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent shadow-sm" />
              <p className="text-sm font-semibold text-slate-600">
                Connecting to camera stream…
              </p>
            </>
          ) : (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl shadow-slate-200/80 border border-slate-200/80">
                <VideoOff size={36} className="text-slate-400" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                Camera Feed Offline
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// TOP CENTER CAMERA EYE SERVO CONTROLLER
// =====================================================

function CameraEyeController({
  disabled,
  onServoCamera,
  compact = false,
}: {
  disabled: boolean;
  onServoCamera: (command: CameraServoCommand, angle?: number) => void;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const pendingAnglesRef = useRef<{ pan: number; tilt: number } | null>(null);
  const lastAnglesRef = useRef<{ pan: number; tilt: number } | null>(null);

  const processOffset = useCallback(
    (offsetX: number, offsetY: number, maxRadius: number) => {
      const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(offsetY, offsetX);

      const px = Math.cos(angle) * clampedDist;
      const py = Math.sin(angle) * clampedDist;
      setPupilPos({ x: px, y: py });

      const pan = Math.round(((px + maxRadius) / (maxRadius * 2)) * 360);
      const tilt = Math.round(
        py < 0 ? (-py / maxRadius) * 90 : -(py / maxRadius) * 60,
      );
      pendingAnglesRef.current = {
        pan: Math.max(0, Math.min(360, pan)),
        tilt: Math.max(-60, Math.min(90, tilt)),
      };

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(() => {
          animationFrameRef.current = null;
          const pending = pendingAnglesRef.current;
          if (!pending || disabled) return;

          const previous = lastAnglesRef.current;
          if (!previous || previous.pan !== pending.pan) {
            onServoCamera("PAN", pending.pan);
          }
          if (!previous || previous.tilt !== pending.tilt) {
            onServoCamera("TILT", pending.tilt);
          }
          lastAnglesRef.current = pending;
        });
      }
    },
    [disabled, onServoCamera],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    processOffset(
      e.clientX - rect.left - cx,
      e.clientY - rect.top - cy,
      cx - 18,
    );
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    processOffset(
      e.clientX - rect.left - cx,
      e.clientY - rect.top - cy,
      cx - 18,
    );
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setPupilPos({ x: 0, y: 0 });
    pendingAnglesRef.current = null;
    lastAnglesRef.current = null;
  };

  return (
    <div className="flex flex-col items-center gap-1.5 select-none touch-none">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={[
          "relative flex items-center justify-center rounded-full border-2 shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing",
          compact ? "h-16 w-16" : "h-24 w-24",
          disabled
            ? "opacity-40 cursor-not-allowed border-slate-200 bg-white/60"
            : "border-slate-300/90 bg-white/85 shadow-slate-300/50 hover:bg-white",
        ].join(" ")}
      >
        {/* Outer target crosshairs */}
        <div className="absolute inset-0 rounded-full border border-slate-300/60 border-dashed" />
        <div className="absolute h-full w-[1px] bg-slate-300/50" />
        <div className="absolute w-full h-[1px] bg-slate-300/50" />

        {/* Directional indicator arrows */}
        <ChevronUp
          size={compact ? 9 : 12}
          className="absolute top-1 text-slate-400"
        />
        <ChevronDown
          size={compact ? 9 : 12}
          className="absolute bottom-1 text-slate-400"
        />
        <ChevronLeft
          size={compact ? 9 : 12}
          className="absolute left-1 text-slate-400"
        />
        <ChevronRight
          size={compact ? 9 : 12}
          className="absolute right-1 text-slate-400"
        />

        {/* Eye Pupil Joystick */}
        <div
          className={`relative flex items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md transition-transform duration-75 ${compact ? "h-7 w-7" : "h-10 w-10"}`}
          style={{
            transform: `translate3d(${pupilPos.x}px, ${pupilPos.y}px, 0)`,
          }}
        >
          <Eye size={compact ? 14 : 20} className="text-white drop-shadow-sm" />
          <div
            className={`absolute bg-white/70 ${compact ? "top-1 right-1 h-1.5 w-1.5" : "top-2 right-2 h-2 w-2"}`}
          />
        </div>
      </div>

      <div
        className={`flex items-center gap-1 rounded-full bg-white/80 border border-slate-200/80 shadow-xs backdrop-blur-sm ${compact ? "px-1.5 py-0" : "px-2.5 py-0.5"}`}
      >
        <span
          className={`${compact ? "text-[8px]" : "text-[10px]"} font-bold uppercase tracking-wider text-slate-600`}
        >
          Cam Pan & Tilt
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onServoCamera("CENTER")}
          className={`text-emerald-600 hover:text-emerald-700 ml-1 font-bold ${compact ? "text-[8px]" : "text-[10px]"}`}
          title="Center Camera"
        >
          [Reset]
        </button>
      </div>
    </div>
  );
}

// =====================================================
// GAME JOYSTICK COMPONENT (INTERACTIVE TOUCH / DRAG)
// =====================================================

function GameDriveJoystick({
  disabled,
  onMove,
  compact = false,
}: {
  disabled: boolean;
  onMove: (cmd: MovementDirection, speed?: number) => boolean | void;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastCmdRef = useRef<MovementDirection | null>(null);

  const stop = useCallback(() => {
    lastCmdRef.current = "STOP";
    onMove("STOP", 0);
  }, [onMove]);

  const processDrag = useCallback(
    (offsetY: number, maxRadius: number) => {
      const clampedY = Math.min(Math.max(offsetY, -maxRadius), maxRadius);
      setKnobPos({ x: 0, y: clampedY });

      const speed = Math.round((Math.abs(clampedY) / maxRadius) * 100);

      if (clampedY < -15) {
        if (lastCmdRef.current !== "FORWARD") {
          lastCmdRef.current = "FORWARD";
          onMove("FORWARD", Math.max(speed, 60));
        }
      } else if (clampedY > 15) {
        if (lastCmdRef.current !== "BACKWARD") {
          lastCmdRef.current = "BACKWARD";
          onMove("BACKWARD", Math.max(speed, 60));
        }
      } else {
        if (lastCmdRef.current !== "STOP") {
          stop();
        }
      }
    },
    [onMove, stop],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cy = rect.height / 2;
    processDrag(e.clientY - rect.top - cy, cy - 25);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cy = rect.height / 2;
    processDrag(e.clientY - rect.top - cy, cy - 25);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    stop();
  };

  return (
    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-3xl bg-white/85 border border-slate-200/90 shadow-xl backdrop-blur-xl select-none touch-none">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
        Drive Throttle
      </span>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={[
          "relative flex items-center justify-center rounded-full border-2 shadow-inner transition-all",
          compact ? "h-24 w-16" : "h-32 w-24",
          disabled
            ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-100"
            : "border-emerald-300/80 bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/80 cursor-grab active:cursor-grabbing",
        ].join(" ")}
      >
        {/* Directional Guide Arrows */}
        <div className="absolute top-2 flex flex-col items-center text-emerald-600">
          <ArrowUp size={compact ? 12 : 16} className="animate-bounce" />
          <span className="text-[8px] font-black uppercase">FWD</span>
        </div>
        <div className="absolute bottom-2 flex flex-col items-center text-emerald-600">
          <span className="text-[8px] font-black uppercase">BACK</span>
          <ArrowDown size={compact ? 12 : 16} className="animate-bounce" />
        </div>

        {/* Vertical Track Line */}
        <div
          className={`absolute rounded-full bg-emerald-200/70 ${compact ? "h-14 w-0.5" : "h-20 w-1"}`}
        />

        {/* Joystick Thumbstick Knob */}
        <div
          className={[
            "relative flex items-center justify-center rounded-full border-2 border-white shadow-xl transition-transform duration-75",
            compact ? "h-10 w-10" : "h-14 w-14",
            isDragging
              ? "bg-gradient-to-tr from-emerald-500 to-teal-600 text-white scale-105"
              : "bg-gradient-to-tr from-slate-700 to-slate-900 text-white",
          ].join(" ")}
          style={{
            transform: `translate3d(0, ${knobPos.y}px, 0)`,
          }}
        >
          <div
            className={`rounded-full border border-white/40 bg-white/20 flex items-center justify-center ${compact ? "h-4 w-4" : "h-6 w-6"}`}
          >
            <div
              className={`${compact ? "h-1.5 w-1.5" : "h-2 w-2"} rounded-full bg-white`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function GameSteerJoystick({
  disabled,
  onMove,
  compact = false,
}: {
  disabled: boolean;
  onMove: (cmd: MovementDirection, speed?: number) => boolean | void;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastCmdRef = useRef<MovementDirection | null>(null);

  const stop = useCallback(() => {
    lastCmdRef.current = "STOP";
    onMove("STOP", 0);
  }, [onMove]);

  const processDrag = useCallback(
    (offsetX: number, maxRadius: number) => {
      const clampedX = Math.min(Math.max(offsetX, -maxRadius), maxRadius);
      setKnobPos({ x: clampedX, y: 0 });

      const speed = Math.round((Math.abs(clampedX) / maxRadius) * 100);

      if (clampedX < -15) {
        if (lastCmdRef.current !== "LEFT") {
          lastCmdRef.current = "LEFT";
          onMove("LEFT", Math.max(speed, 60));
        }
      } else if (clampedX > 15) {
        if (lastCmdRef.current !== "RIGHT") {
          lastCmdRef.current = "RIGHT";
          onMove("RIGHT", Math.max(speed, 60));
        }
      } else {
        if (lastCmdRef.current !== "STOP") {
          stop();
        }
      }
    },
    [onMove, stop],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    processDrag(e.clientX - rect.left - cx, cx - 25);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    processDrag(e.clientX - rect.left - cx, cx - 25);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    stop();
  };

  return (
    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-3xl bg-white/85 border border-slate-200/90 shadow-xl backdrop-blur-xl select-none touch-none">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">
        Steering Joystick
      </span>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={[
          "relative flex items-center justify-center rounded-full border-2 shadow-inner transition-all",
          compact ? "h-16 w-24" : "h-24 w-32",
          disabled
            ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-100"
            : "border-sky-300/80 bg-gradient-to-r from-sky-50/80 via-white to-sky-50/80 cursor-grab active:cursor-grabbing",
        ].join(" ")}
      >
        {/* Directional Guide Arrows */}
        <div className="absolute left-2 flex items-center gap-1 text-sky-600">
          <ArrowLeft size={compact ? 12 : 16} className="animate-bounce" />
          <span className="text-[8px] font-black uppercase">LFT</span>
        </div>
        <div className="absolute right-2 flex items-center gap-1 text-sky-600">
          <span className="text-[8px] font-black uppercase">RGT</span>
          <ArrowRight size={compact ? 12 : 16} className="animate-bounce" />
        </div>

        {/* Horizontal Track Line */}
        <div
          className={`absolute rounded-full bg-sky-200/70 ${compact ? "w-14 h-0.5" : "w-20 h-1"}`}
        />

        {/* Joystick Thumbstick Knob */}
        <div
          className={[
            "relative flex items-center justify-center rounded-full border-2 border-white shadow-xl transition-transform duration-75",
            compact ? "h-10 w-10" : "h-14 w-14",
            isDragging
              ? "bg-gradient-to-tr from-sky-500 to-indigo-600 text-white scale-105"
              : "bg-gradient-to-tr from-slate-700 to-slate-900 text-white",
          ].join(" ")}
          style={{
            transform: `translate3d(${knobPos.x}px, 0, 0)`,
          }}
        >
          <div
            className={`rounded-full border border-white/40 bg-white/20 flex items-center justify-center ${compact ? "h-4 w-4" : "h-6 w-6"}`}
          >
            <div
              className={`${compact ? "h-1.5 w-1.5" : "h-2 w-2"} rounded-full bg-white`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// ESP MODULE ONLINE BADGE BAR
// =====================================================

function EspStatusBadge({
  label,
  roleName,
  connected,
  icon: Icon,
}: {
  label: string;
  roleName: string;
  connected: boolean;
  icon: typeof Cpu;
}) {
  return (
    <div
      className={[
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-xs backdrop-blur-md transition-all",
        connected
          ? "border-emerald-300/80 bg-white/90 text-emerald-700 shadow-emerald-100"
          : "border-slate-200/80 bg-white/70 text-slate-400",
      ].join(" ")}
      title={`${roleName} module is ${connected ? "Online" : "Offline"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
        }`}
      />
      <Icon
        size={12}
        className={connected ? "text-emerald-600" : "text-slate-400"}
      />
      <span>{label}</span>
    </div>
  );
}

// =====================================================
// PAGE COMPONENT
// =====================================================

export default function BotPage() {
  const params = useParams<{ robotId: string }>();
  const robotId = params.robotId;

  // ===================================================
  // WEBSOCKET & TELEMETRY HOOK
  // ===================================================

  const {
    connected: gatewayConnected,
    status: liveStatus,
    telemetry,
    espRoles,
    movementConnected,
    cameraConnected,
    cameraStreamOn,
    cameraFrame,
    servoConnected,
    sprayOn,
    sendMovement,
    sendServoCamera,
    sendCameraStream,
    sendSpray,
    waterPumpConnected,
    refillOn,
    waterSprayOn,
    tankFull,
    waterDistanceCm,
    waterPercent,
    sensorPresent,
    sendWaterRefill,
    sendWaterSpray,
    sendHorn,
  } = useRobotSocket(robotId, [
    "MOVEMENT_AND_OTHER",
    "CAMERA",
    "SERVO",
    "WATER_PUMP",
  ]);

  // ===================================================
  // STATE
  // ===================================================

  const [bot, setBot] = useState<BotDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWaterPanel, setShowWaterPanel] = useState(false);

  // Keyboard navigation WASD & Arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === "w" || e.key === "ArrowUp") sendMovement("FORWARD", 100);
      else if (k === "s" || e.key === "ArrowDown")
        sendMovement("BACKWARD", 100);
      else if (k === "a" || e.key === "ArrowLeft") sendMovement("LEFT", 100);
      else if (k === "d" || e.key === "ArrowRight") sendMovement("RIGHT", 100);
      else if (e.key === " ") sendMovement("STOP", 0);
      else if (k === "h") sendHorn(1);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        [
          "w",
          "s",
          "a",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      ) {
        sendMovement("STOP", 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [sendMovement, sendHorn]);

  // Load Bot API
  const loadBot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get<{
        success: boolean;
        data: BotDetails;
      }>(`/robots/${encodeURIComponent(robotId)}`);

      if (!response.data.success) {
        throw new Error("Unable to load this bot.");
      }
      setBot(response.data.data);
    } catch (err) {
      setBot(null);
      setError(
        isAxiosError(err)
          ? err.response?.data?.message || "Unable to load this bot."
          : err instanceof Error
            ? err.message
            : "Unable to load this bot.",
      );
    } finally {
      setLoading(false);
    }
  }, [robotId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBot();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadBot]);

  const resolvedStatus: BotStatus = isBotStatus(liveStatus)
    ? liveStatus
    : isBotStatus(bot?.status)
      ? bot!.status
      : "offline";

  const canControl = bot?.role === "owner" || bot?.role === "operator";
  const controlDisabled =
    !gatewayConnected || resolvedStatus === "offline" || !canControl;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent shadow-sm" />
          <p className="text-sm font-semibold text-slate-600">
            Loading AgriBot Controls…
          </p>
        </div>
      </main>
    );
  }

  if (error || !bot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-8 shadow-xl">
          <h1 className="text-lg font-bold text-slate-800">
            Robot unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {error || "This robot could not be found."}
          </p>
          <Link
            href="/dashboard/mybots"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-500"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to my bots
          </Link>
        </section>
      </main>
    );
  }

  const movementEspConnected =
    espRoles.MOVEMENT_AND_OTHER ||
    movementConnected ||
    (gatewayConnected && resolvedStatus === "online");

  return (
    <>
      {/* ===================================================
          1. MOBILE / SMALL SCREEN VIEW (FULLSCREEN GAME HUD)
          Visible on screens < lg (phones & tablets)
         =================================================== */}
      <main className="mobile-control-hud lg:hidden relative h-screen w-screen overflow-hidden bg-slate-900 text-slate-800 select-none touch-none">
        {/* Fullscreen Camera Stream Background */}
        <CameraBg
          frame={cameraFrame}
          cameraConnected={cameraConnected}
          streamEnabled={cameraStreamOn}
        />

        {/* Floating Game HUD Overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
          {/* TOP BAR: HEADER & ESP STATUS BADGES */}
          <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-2">
            {/* Left: Back Button & Bot Identity */}
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/mybots"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-md backdrop-blur-md transition hover:bg-white"
                title="Back to Bots"
              >
                <ArrowLeft size={18} />
              </Link>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-md backdrop-blur-md">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[resolvedStatus]}`}
                />
                <span className="text-xs font-bold text-slate-800">
                  {bot.name}
                </span>
                <span
                  className={`text-[10px] font-extrabold uppercase ${STATUS_COLOR[resolvedStatus]}`}
                >
                  {resolvedStatus}
                </span>
              </div>

              <button
                type="button"
                disabled={!cameraConnected || controlDisabled}
                onClick={() => sendCameraStream(cameraStreamOn ? "OFF" : "ON")}
                className="flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/90 px-2.5 text-[10px] font-extrabold text-slate-700 shadow-md backdrop-blur-md disabled:opacity-40"
                title={
                  cameraStreamOn
                    ? "Turn camera stream off"
                    : "Turn camera stream on"
                }
              >
                {cameraStreamOn ? <VideoOff size={15} /> : <Video size={15} />}
                <span>{cameraStreamOn ? "Camera Off" : "Camera On"}</span>
              </button>
            </div>

            {/* Right: All ESP Roles Indicators */}
            <div className="flex flex-wrap items-center gap-1 bg-white/80 p-1 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-md scale-90 sm:scale-100 origin-right">
              <EspStatusBadge
                label="Movement"
                roleName="MOVEMENT_AND_OTHER"
                connected={movementEspConnected}
                icon={Cpu}
              />
              <EspStatusBadge
                label="Water"
                roleName="WATER_PUMP"
                connected={espRoles.WATER_PUMP}
                icon={Waves}
              />
              <EspStatusBadge
                label="Camera"
                roleName="CAMERA"
                connected={espRoles.CAMERA}
                icon={Video}
              />
              <EspStatusBadge
                label="Servo"
                roleName="SERVO"
                connected={espRoles.SERVO}
                icon={Crosshair}
              />
            </div>
          </header>

          {/* TOP CENTER: CAMERA EYE PAN/TILT CONTROLLER */}
          <div className="pointer-events-auto relative flex flex-1 flex-col items-center justify-start pt-2">
            <CameraEyeController
              disabled={controlDisabled}
              onServoCamera={sendServoCamera}
              compact
            />
          </div>

          {/* BOTTOM GAME CONTROLS BAR */}
          <footer className="mobile-control-footer pointer-events-auto flex items-end justify-between gap-2 pb-1">
            {/* BOTTOM LEFT: DRIVE THROTTLE + HORN BUTTON */}
            <div className="flex items-end gap-2">
              <GameDriveJoystick
                disabled={controlDisabled}
                onMove={sendMovement}
                compact
              />

              {/* HORN BUTTON */}
              <button
                id="horn-btn"
                type="button"
                disabled={controlDisabled}
                onPointerDown={(e) => {
                  e.preventDefault();
                  sendHorn(1);
                }}
                className="mobile-action-button flex h-16 w-16 flex-col items-center justify-center rounded-3xl border-2 border-amber-300 bg-amber-50/90 text-amber-700 shadow-xl font-bold transition active:scale-90 hover:bg-amber-100 disabled:opacity-40 backdrop-blur-md"
                title="Sound Horn"
              >
                <Volume2 size={18} className="text-amber-600" />
                <span className="text-[9px] font-extrabold uppercase mt-0.5">
                  Horn
                </span>
              </button>
            </div>

            {/* BOTTOM CENTER: TELEMETRY FLOATING PILLS */}
            <div className="mobile-telemetry hidden sm:flex items-center gap-2 bg-white/80 p-2 rounded-3xl border border-slate-200/80 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
                <Battery size={14} className="text-emerald-600" />
                <span>
                  {telemetry?.battery !== undefined
                    ? `${telemetry.battery}%`
                    : "100%"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
                <Gauge size={14} className="text-sky-600" />
                <span>
                  {telemetry?.speed !== undefined
                    ? `${telemetry.speed.toFixed(1)} km/h`
                    : "0.0 km/h"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
                <Cpu size={14} className="text-indigo-600" />
                <span>
                  {telemetry?.rpm !== undefined
                    ? `${telemetry.rpm} RPM`
                    : "0 RPM"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
                <Thermometer size={14} className="text-rose-600" />
                <span>
                  {telemetry?.temperature !== undefined
                    ? `${telemetry.temperature}°C`
                    : "32°C"}
                </span>
              </div>
            </div>

            {/* BOTTOM RIGHT: STEERING CONTROLLER + SPRAY TOGGLE + WATER PUMP TOGGLE */}
            <div className="flex items-end gap-2">
              {/* SPRAY ACTION TOGGLE */}
              <button
                type="button"
                disabled={controlDisabled}
                onClick={() => {
                  const nextState = sprayOn ? "OFF" : "ON";
                  sendSpray(nextState);
                }}
                className={[
                  "mobile-action-button flex h-16 w-16 flex-col items-center justify-center rounded-3xl border-2 font-bold shadow-xl transition active:scale-90 disabled:opacity-40 backdrop-blur-md",
                  sprayOn
                    ? "border-teal-400 bg-teal-100/90 text-teal-700 shadow-teal-200 animate-pulse"
                    : "border-slate-200 bg-white/90 text-slate-600 hover:bg-white",
                ].join(" ")}
                title="Toggle Spray Servo"
              >
                <Droplets
                  size={18}
                  className={sprayOn ? "text-teal-600" : "text-slate-400"}
                />
                <span className="text-[9px] font-extrabold uppercase mt-0.5">
                  {sprayOn ? "Spray ON" : "Spray"}
                </span>
              </button>

              {/* WATER PUMP DRAWER TOGGLE */}
              <button
                type="button"
                disabled={controlDisabled}
                onClick={() => setShowWaterPanel((prev) => !prev)}
                className={[
                  "mobile-action-button flex h-16 w-16 flex-col items-center justify-center rounded-3xl border-2 font-bold shadow-xl transition active:scale-90 disabled:opacity-40 backdrop-blur-md",
                  showWaterPanel || refillOn || waterSprayOn
                    ? "border-cyan-400 bg-cyan-100/90 text-cyan-700 shadow-cyan-200"
                    : "border-slate-200 bg-white/90 text-slate-600 hover:bg-white",
                ].join(" ")}
                title="Water Pump Control Panel"
              >
                <Waves
                  size={18}
                  className={
                    refillOn || waterSprayOn
                      ? "text-cyan-600"
                      : "text-slate-500"
                  }
                />
                <span className="text-[9px] font-extrabold uppercase mt-0.5">
                  Pump Panel
                </span>
              </button>

              {/* STEERING JOYSTICK */}
              <GameSteerJoystick
                disabled={controlDisabled}
                onMove={sendMovement}
                compact
              />
            </div>
          </footer>

          {/* FLOATING WATER PUMP CONTROL CARD POPUP */}
          {showWaterPanel && (
            <div className="mobile-water-panel pointer-events-auto absolute bottom-24 right-4 z-50 w-72 sm:w-80 shadow-2xl rounded-3xl border border-slate-200 bg-white/95 p-2 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between px-3 py-1 border-b border-slate-100 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Waves size={16} className="text-cyan-600" />
                  Water Pump System
                </span>
                <button
                  type="button"
                  onClick={() => setShowWaterPanel(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕ Close
                </button>
              </div>
              <WaterPumpController
                disabled={controlDisabled}
                connected={waterPumpConnected}
                refillOn={refillOn}
                sprayOn={waterSprayOn}
                tankFull={tankFull}
                waterDistanceCm={waterDistanceCm}
                waterPercent={waterPercent}
                sensorPresent={sensorPresent}
                onRefill={sendWaterRefill}
                onSpray={sendWaterSpray}
              />
            </div>
          )}
        </div>
      </main>

      {/* ===================================================
          2. DESKTOP / LAPTOP VIEW (MINIMALISTIC WHITE DASHBOARD)
          Visible on screens >= lg (laptops & desktops)
         =================================================== */}
      <main className="hidden lg:block min-h-screen w-full bg-slate-50 text-slate-900 select-none pb-10">
        {/* TOP BAR: HEADER & ESP STATUS BADGES */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* Left: Back Button & Bot Identity */}
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/mybots"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 shadow-xs hover:bg-slate-200 transition"
                title="Back to Bots"
              >
                <ArrowLeft size={18} />
              </Link>

              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-xs">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[resolvedStatus]}`}
                />
                <span className="text-sm font-extrabold text-slate-900">
                  {bot.name}
                </span>
                <span
                  className={`text-[11px] font-extrabold uppercase tracking-wider ${STATUS_COLOR[resolvedStatus]}`}
                >
                  {resolvedStatus}
                </span>
              </div>
            </div>

            {/* Right: All ESP Roles Online Indicators */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
              <EspStatusBadge
                label="Movement ESP"
                roleName="MOVEMENT_AND_OTHER"
                connected={movementEspConnected}
                icon={Cpu}
              />
              <EspStatusBadge
                label="Water ESP"
                roleName="WATER_PUMP"
                connected={espRoles.WATER_PUMP}
                icon={Waves}
              />
              <EspStatusBadge
                label="Camera ESP"
                roleName="CAMERA"
                connected={espRoles.CAMERA}
                icon={Video}
              />
              <EspStatusBadge
                label="Servo ESP"
                roleName="SERVO"
                connected={espRoles.SERVO}
                icon={Crosshair}
              />
            </div>
          </div>
        </header>

        {/* MAIN CONTENT GRID */}
        <div className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-6">
          {/* LEFT COLUMN (COL-SPAN 7): MEDIUM SQUARE CAMERA PREVIEW */}
          <div className="col-span-7 flex flex-col gap-6">
            {/* CAMERA CARD */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4">
              {/* Camera Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-slate-100 border border-slate-200">
                    <Video size={16} className="text-slate-700" />
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Live Camera Feed
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!cameraConnected || controlDisabled}
                    onClick={() =>
                      sendCameraStream(cameraStreamOn ? "OFF" : "ON")
                    }
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 disabled:opacity-40"
                    title={
                      cameraStreamOn
                        ? "Turn camera stream off"
                        : "Turn camera stream on"
                    }
                  >
                    {cameraStreamOn ? (
                      <VideoOff size={13} />
                    ) : (
                      <Video size={13} />
                    )}
                    <span>{cameraStreamOn ? "Stream Off" : "Stream On"}</span>
                  </button>
                  {cameraConnected && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      LIVE • QVGA
                    </span>
                  )}
                </div>
              </div>

              {/* Medium Square / 4:3 Video Display Area */}
              <div className="relative w-full aspect-[4/3] max-w-lg mx-auto bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-200">
                <CameraBg
                  frame={cameraFrame}
                  cameraConnected={cameraConnected}
                  streamEnabled={cameraStreamOn}
                />

                {/* FLOATING TOP-CENTER EYE SERVO CONTROLLER */}
                <div className="absolute top-3 inset-x-0 flex justify-center z-10 pointer-events-auto">
                  <CameraEyeController
                    disabled={controlDisabled}
                    onServoCamera={sendServoCamera}
                  />
                </div>
              </div>

              {/* Camera Tip */}
              <p className="text-center text-xs font-semibold text-slate-500">
                💡 Drag eye controller to pan/tilt camera nozzle • Auto-centers
                on release
              </p>
            </div>

            {/* TELEMETRY METRICS GRID */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                Telemetry & Sensors
              </span>

              <div className="grid grid-cols-5 gap-2.5">
                <div className="flex flex-col gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Battery size={13} className="text-emerald-600" />
                    <span>Battery</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {telemetry?.battery !== undefined
                      ? `${telemetry.battery}%`
                      : "100%"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Gauge size={13} className="text-sky-600" />
                    <span>Speed</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {telemetry?.speed !== undefined
                      ? `${telemetry.speed.toFixed(1)} km/h`
                      : "0.0 km/h"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Cpu size={13} className="text-indigo-600" />
                    <span>RPM</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {telemetry?.rpm !== undefined
                      ? `${telemetry.rpm} RPM`
                      : "0 RPM"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Thermometer size={13} className="text-rose-600" />
                    <span>Temp</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {telemetry?.temperature !== undefined
                      ? `${telemetry.temperature}°C`
                      : "32°C"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Waves size={13} className="text-cyan-600" />
                    <span>Tank Level</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {waterPercent !== null && waterPercent !== undefined
                      ? `${waterPercent}%`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (COL-SPAN 5): CONTROLS & WATER SYSTEM */}
          <div className="col-span-5 flex flex-col gap-6">
            {/* MOVEMENT & DRIVE CARD */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-slate-100 border border-slate-200">
                    <BotIcon size={16} className="text-slate-700" />
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Robot Drive & Steering
                  </span>
                </div>

                <button
                  id="horn-btn"
                  type="button"
                  disabled={controlDisabled}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    sendHorn(1);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-extrabold hover:bg-amber-100 transition active:scale-95 shadow-xs disabled:opacity-40"
                  title="Sound Horn"
                >
                  <Volume2 size={14} className="text-amber-600" />
                  <span>HORN [H]</span>
                </button>
              </div>

              {/* Side-by-Side Joysticks */}
              <div className="flex items-center justify-around gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <GameDriveJoystick
                  disabled={controlDisabled}
                  onMove={sendMovement}
                />
                <GameSteerJoystick
                  disabled={controlDisabled}
                  onMove={sendMovement}
                />
              </div>

              {/* Quick Action Button Bar */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* SPRAY ACTION TOGGLE */}
                <button
                  type="button"
                  disabled={controlDisabled}
                  onClick={() => {
                    const nextState = sprayOn ? "OFF" : "ON";
                    sendSpray(nextState);
                  }}
                  className={[
                    "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-extrabold shadow-xs transition active:scale-95 disabled:opacity-40",
                    sprayOn
                      ? "border-teal-300 bg-teal-600 text-white shadow-teal-200"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <Droplets
                    size={16}
                    className={sprayOn ? "animate-bounce" : "text-slate-400"}
                  />
                  <span>{sprayOn ? "SPRAYING ON" : "TOGGLE SPRAY"}</span>
                </button>

                {/* EMERGENCY STOP */}
                <button
                  type="button"
                  disabled={controlDisabled}
                  onClick={() => sendMovement("STOP", 0)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 px-4 py-3 text-xs font-extrabold shadow-xs transition active:scale-95 disabled:opacity-40"
                >
                  <Square size={14} className="text-rose-600 fill-rose-600" />
                  <span>STOP [SPACE]</span>
                </button>
              </div>

              {/* Keyboard shortcut hint */}
              <p className="text-center text-[11px] font-medium text-slate-400">
                Press{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                  W
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] ml-0.5">
                  A
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] ml-0.5">
                  S
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] ml-0.5">
                  D
                </kbd>{" "}
                or Arrow keys to drive
              </p>
            </div>

            {/* WATER PUMP SYSTEM CONTROLLER */}
            <WaterPumpController
              disabled={controlDisabled}
              connected={waterPumpConnected}
              refillOn={refillOn}
              sprayOn={waterSprayOn}
              tankFull={tankFull}
              waterDistanceCm={waterDistanceCm}
              waterPercent={waterPercent}
              sensorPresent={sensorPresent}
              onRefill={sendWaterRefill}
              onSpray={sendWaterSpray}
            />
          </div>
        </div>
      </main>
    </>
  );
}
