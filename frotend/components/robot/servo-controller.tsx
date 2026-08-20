"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Droplets,
} from "lucide-react";
import type { CameraServoCommand, SprayCommand } from "@/lib/robot-events";

interface ServoControllerProps {
  disabled: boolean;
  sprayOn: boolean;
  onServoCamera: (command: CameraServoCommand) => void;
  onSpray: (command: SprayCommand) => void;
}

const SERVO_DIRECTIONS: Array<{
  command: CameraServoCommand;
  label: string;
  icon: typeof ChevronUp;
  grid: string;
}> = [
  { command: "UP",    label: "Tilt up",    icon: ChevronUp,    grid: "col-start-2 row-start-1" },
  { command: "LEFT",  label: "Pan left",   icon: ChevronLeft,  grid: "col-start-1 row-start-2" },
  { command: "CENTER",label: "Center",     icon: Crosshair,    grid: "col-start-2 row-start-2" },
  { command: "RIGHT", label: "Pan right",  icon: ChevronRight, grid: "col-start-3 row-start-2" },
  { command: "DOWN",  label: "Tilt down",  icon: ChevronDown,  grid: "col-start-2 row-start-3" },
];

export function ServoController({
  disabled,
  sprayOn,
  onServoCamera,
  onSpray,
}: ServoControllerProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Camera servo pan/tilt */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Camera Aim
        </p>
        <div className="grid w-44 grid-cols-3 grid-rows-3 gap-2">
          {SERVO_DIRECTIONS.map(({ command, label, icon: Icon, grid }) => {
            const isCenter = command === "CENTER";
            return (
              <button
                key={command}
                type="button"
                disabled={disabled}
                aria-label={label}
                onClick={() => onServoCamera(command)}
                className={[
                  grid,
                  "flex h-12 w-12 items-center justify-center rounded-lg border text-sm font-medium transition-all duration-150",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                  "disabled:cursor-not-allowed disabled:opacity-30",
                  isCenter
                    ? "border-emerald-600/40 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-800/40 active:scale-95"
                    : "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:border-gray-600 active:scale-95",
                ].join(" ")}
              >
                <Icon size={18} aria-hidden />
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Click to pan / tilt the camera servo.
        </p>
      </div>

      {/* Spray control */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Spray
        </p>
        <button
          type="button"
          disabled={disabled}
          aria-label={sprayOn ? "Turn spray off" : "Turn spray on"}
          onClick={() => onSpray(sprayOn ? "OFF" : "ON")}
          className={[
            "flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
            "disabled:cursor-not-allowed disabled:opacity-30",
            sprayOn
              ? "border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 shadow-[0_0_14px_rgba(59,130,246,0.25)]"
              : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700",
          ].join(" ")}
        >
          <Droplets
            size={18}
            className={sprayOn ? "text-blue-400 animate-bounce" : "text-gray-400"}
            aria-hidden
          />
          {sprayOn ? "Spray ON — tap to stop" : "Spray OFF — tap to start"}
          {sprayOn && (
            <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          )}
        </button>
      </div>
    </div>
  );
}
