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

type BotStatus =
  | "online"
  | "offline"
  | "idle"
  | "busy"
  | "maintenance";

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

  role:
    | "owner"
    | "operator"
    | "viewer"
    | "technician";
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
}: {
  frame: string | null;
  cameraConnected: boolean;
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
          {cameraConnected ? (
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
}: {
  disabled: boolean;
  onServoCamera: (command: CameraServoCommand) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastCmdRef = useRef<CameraServoCommand | null>(null);

  const triggerServo = useCallback(
    (cmd: CameraServoCommand) => {
      if (disabled) return;
      if (lastCmdRef.current !== cmd) {
        lastCmdRef.current = cmd;
        onServoCamera(cmd);
      }
    },
    [disabled, onServoCamera],
  );

  const processOffset = useCallback(
    (offsetX: number, offsetY: number, maxRadius: number) => {
      const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(offsetY, offsetX);

      const px = Math.cos(angle) * clampedDist;
      const py = Math.sin(angle) * clampedDist;
      setPupilPos({ x: px, y: py });

      if (dist < 15) {
        triggerServo("CENTER");
      } else if (Math.abs(offsetX) > Math.abs(offsetY)) {
        triggerServo(offsetX > 0 ? "RIGHT" : "LEFT");
      } else {
        triggerServo(offsetY > 0 ? "DOWN" : "UP");
      }
    },
    [triggerServo],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    processOffset(e.clientX - rect.left - cx, e.clientY - rect.top - cy, cx - 18);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    processOffset(e.clientX - rect.left - cx, e.clientY - rect.top - cy, cx - 18);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setPupilPos({ x: 0, y: 0 });
    lastCmdRef.current = null;
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
          "relative flex h-24 w-24 items-center justify-center rounded-full border-2 shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing",
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
        <ChevronUp size={12} className="absolute top-1 text-slate-400" />
        <ChevronDown size={12} className="absolute bottom-1 text-slate-400" />
        <ChevronLeft size={12} className="absolute left-1 text-slate-400" />
        <ChevronRight size={12} className="absolute right-1 text-slate-400" />

        {/* Eye Pupil Joystick */}
        <div
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md transition-transform duration-75"
          style={{
            transform: `translate3d(${pupilPos.x}px, ${pupilPos.y}px, 0)`,
          }}
        >
          <Eye size={20} className="text-white drop-shadow-sm" />
          <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-white/70" />
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 border border-slate-200/80 shadow-xs backdrop-blur-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
          Cam Pan & Tilt
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onServoCamera("CENTER")}
          className="text-emerald-600 hover:text-emerald-700 ml-1 text-[10px] font-bold"
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
}: {
  disabled: boolean;
  onMove: (cmd: MovementDirection, speed?: number) => boolean | void;
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
          "relative flex h-32 w-24 items-center justify-center rounded-full border-2 shadow-inner transition-all",
          disabled
            ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-100"
            : "border-emerald-300/80 bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/80 cursor-grab active:cursor-grabbing",
        ].join(" ")}
      >
        {/* Directional Guide Arrows */}
        <div className="absolute top-2 flex flex-col items-center text-emerald-600">
          <ArrowUp size={16} className="animate-bounce" />
          <span className="text-[8px] font-black uppercase">FWD</span>
        </div>
        <div className="absolute bottom-2 flex flex-col items-center text-emerald-600">
          <span className="text-[8px] font-black uppercase">BACK</span>
          <ArrowDown size={16} className="animate-bounce" />
        </div>

        {/* Vertical Track Line */}
        <div className="absolute h-20 w-1 rounded-full bg-emerald-200/70" />

        {/* Joystick Thumbstick Knob */}
        <div
          className={[
            "relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shadow-xl transition-transform duration-75",
            isDragging
              ? "bg-gradient-to-tr from-emerald-500 to-teal-600 text-white scale-105"
              : "bg-gradient-to-tr from-slate-700 to-slate-900 text-white",
          ].join(" ")}
          style={{
            transform: `translate3d(0, ${knobPos.y}px, 0)`,
          }}
        >
          <div className="h-6 w-6 rounded-full border border-white/40 bg-white/20 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function GameSteerJoystick({
  disabled,
  onMove,
}: {
  disabled: boolean;
  onMove: (cmd: MovementDirection, speed?: number) => boolean | void;
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
          "relative flex h-24 w-32 items-center justify-center rounded-full border-2 shadow-inner transition-all",
          disabled
            ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-100"
            : "border-sky-300/80 bg-gradient-to-r from-sky-50/80 via-white to-sky-50/80 cursor-grab active:cursor-grabbing",
        ].join(" ")}
      >
        {/* Directional Guide Arrows */}
        <div className="absolute left-2 flex items-center gap-1 text-sky-600">
          <ArrowLeft size={16} className="animate-bounce" />
          <span className="text-[8px] font-black uppercase">LFT</span>
        </div>
        <div className="absolute right-2 flex items-center gap-1 text-sky-600">
          <span className="text-[8px] font-black uppercase">RGT</span>
          <ArrowRight size={16} className="animate-bounce" />
        </div>

        {/* Horizontal Track Line */}
        <div className="absolute w-20 h-1 rounded-full bg-sky-200/70" />

        {/* Joystick Thumbstick Knob */}
        <div
          className={[
            "relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shadow-xl transition-transform duration-75",
            isDragging
              ? "bg-gradient-to-tr from-sky-500 to-indigo-600 text-white scale-105"
              : "bg-gradient-to-tr from-slate-700 to-slate-900 text-white",
          ].join(" ")}
          style={{
            transform: `translate3d(${knobPos.x}px, 0, 0)`,
          }}
        >
          <div className="h-6 w-6 rounded-full border border-white/40 bg-white/20 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-white" />
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
      <Icon size={12} className={connected ? "text-emerald-600" : "text-slate-400"} />
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
    cameraFrame,
    servoConnected,
    sprayOn,
    sendMovement,
    sendServoCamera,
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
      else if (k === "s" || e.key === "ArrowDown") sendMovement("BACKWARD", 100);
      else if (k === "a" || e.key === "ArrowLeft") sendMovement("LEFT", 100);
      else if (k === "d" || e.key === "ArrowRight") sendMovement("RIGHT", 100);
      else if (e.key === " ") sendMovement("STOP", 0);
      else if (k === "h") sendHorn(1);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "s", "a", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
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
  const controlDisabled = !gatewayConnected || resolvedStatus === "offline" || !canControl;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent shadow-sm" />
          <p className="text-sm font-semibold text-slate-600">Loading AgriBot Controls…</p>
        </div>
      </main>
    );
  }

  if (error || !bot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-8 shadow-xl">
          <h1 className="text-lg font-bold text-slate-800">Robot unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error || "This robot could not be found."}</p>
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
    espRoles.MOVEMENT_AND_OTHER || movementConnected || (gatewayConnected && resolvedStatus === "online");

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 select-none">
      {/* Camera Stream Background */}
      <CameraBg frame={cameraFrame} cameraConnected={cameraConnected} />

      {/* Main HUD overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
        
        {/* ===================================================
            TOP BAR: HEADER & ESP STATUS BADGES
           =================================================== */}
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

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-md backdrop-blur-md">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[resolvedStatus]}`} />
              <span className="text-xs font-bold text-slate-800">{bot.name}</span>
              <span className={`text-[10px] font-extrabold uppercase ${STATUS_COLOR[resolvedStatus]}`}>
                {resolvedStatus}
              </span>
            </div>
          </div>

          {/* Center-Right: All ESP Roles Online Indicators */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-md">
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
        </header>

        {/* ===================================================
            MIDDLE VIEWPORT: CAMERA EYE CONTROLLER AT TOP CENTER
           =================================================== */}
        <div className="pointer-events-auto relative flex flex-1 flex-col items-center justify-start pt-2">
          <CameraEyeController
            disabled={controlDisabled}
            onServoCamera={sendServoCamera}
          />
        </div>

        {/* ===================================================
            BOTTOM CONTROLS BAR: SPLIT JOYSTICKS, HORN, TELEMETRY, ACTION BUTTONS
           =================================================== */}
        <footer className="pointer-events-auto flex items-end justify-between gap-2 pb-1">
          
          {/* BOTTOM LEFT: DRIVE THROTTLE + HORN BUTTON */}
          <div className="flex items-end gap-2">
            <GameDriveJoystick
              disabled={controlDisabled}
              onMove={sendMovement}
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
              className={[
                "flex h-16 w-16 flex-col items-center justify-center rounded-3xl border-2 border-amber-300 bg-amber-50 text-amber-700 shadow-xl font-bold transition active:scale-90 hover:bg-amber-100 disabled:opacity-40 backdrop-blur-md",
              ].join(" ")}
              title="Sound Horn"
            >
              <Volume2 size={24} className="text-amber-600" />
              <span className="text-[9px] font-extrabold uppercase mt-0.5">Horn</span>
            </button>
          </div>

          {/* BOTTOM CENTER: TELEMETRY PILLS */}
          <div className="hidden sm:flex items-center gap-2 bg-white/80 p-2 rounded-3xl border border-slate-200/80 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
              <Battery size={14} className="text-emerald-600" />
              <span>{telemetry?.battery !== undefined ? `${telemetry.battery}%` : "--"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
              <Gauge size={14} className="text-sky-600" />
              <span>{telemetry?.speed !== undefined ? `${telemetry.speed} km/h` : "0 km/h"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
              <Thermometer size={14} className="text-rose-600" />
              <span>{telemetry?.temperature !== undefined ? `${telemetry.temperature}°C` : "--"}</span>
            </div>
          </div>

          {/* BOTTOM RIGHT: STEERING CONTROLLER + SPRAY TOGGLE + WATER PUMP TOGGLE */}
          <div className="flex items-end gap-2">
            
            {/* SPRAY ACTION TOGGLE */}
            <button
              type="button"
              disabled={controlDisabled}
              onClick={() => sendSpray(sprayOn ? "OFF" : "ON")}
              className={[
                "flex h-16 w-16 flex-col items-center justify-center rounded-3xl border-2 font-bold shadow-xl transition active:scale-90 disabled:opacity-40 backdrop-blur-md",
                sprayOn
                  ? "border-blue-400 bg-blue-100 text-blue-700 shadow-blue-200 animate-pulse"
                  : "border-slate-200 bg-white/90 text-slate-600 hover:bg-white",
              ].join(" ")}
              title="Toggle Spray Nozzle"
            >
              <Droplets size={24} className={sprayOn ? "text-blue-600" : "text-slate-400"} />
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
                "flex h-16 w-16 flex-col items-center justify-center rounded-3xl border-2 font-bold shadow-xl transition active:scale-90 disabled:opacity-40 backdrop-blur-md",
                showWaterPanel || refillOn || waterSprayOn
                  ? "border-cyan-400 bg-cyan-100 text-cyan-700 shadow-cyan-200"
                  : "border-slate-200 bg-white/90 text-slate-600 hover:bg-white",
              ].join(" ")}
              title="Water Pump Control Panel"
            >
              <Waves size={24} className={refillOn || waterSprayOn ? "text-cyan-600" : "text-slate-500"} />
              <span className="text-[9px] font-extrabold uppercase mt-0.5">Pump Panel</span>
            </button>

            {/* STEERING JOYSTICK */}
            <GameSteerJoystick
              disabled={controlDisabled}
              onMove={sendMovement}
            />
          </div>

        </footer>

        {/* FLOATING WATER PUMP CONTROL CARD */}
        {showWaterPanel && (
          <div className="pointer-events-auto absolute bottom-24 right-4 z-50 w-72 sm:w-80 shadow-2xl rounded-3xl border border-slate-200 bg-white/95 p-2 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
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
  );
}