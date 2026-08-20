"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Square } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { MovementDirection } from "@/lib/robot-events";

interface MovementControllerProps {
  disabled: boolean;
  onMove: (command: MovementDirection, speed?: number) => boolean | void;
}

const controls: Array<{
  command: MovementDirection;
  label: string;
  keyLabel: string;
  icon: typeof ArrowUp;
  grid: string;
}> = [
  { command: "FORWARD",  label: "Move Forward (W)",  keyLabel: "W", icon: ArrowUp,    grid: "col-start-2 row-start-1" },
  { command: "LEFT",     label: "Turn Left (A)",     keyLabel: "A", icon: ArrowLeft,  grid: "col-start-1 row-start-2" },
  { command: "STOP",     label: "Emergency Stop (Space)", keyLabel: "STOP", icon: Square, grid: "col-start-2 row-start-2" },
  { command: "RIGHT",    label: "Turn Right (D)",    keyLabel: "D", icon: ArrowRight, grid: "col-start-3 row-start-2" },
  { command: "BACKWARD", label: "Move Backward (S)", keyLabel: "S", icon: ArrowDown,  grid: "col-start-2 row-start-3" },
];

export function MovementController({ disabled, onMove }: MovementControllerProps) {
  const activeKeyRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    activeKeyRef.current = null;
    onMove("STOP", 0);
  }, [onMove]);

  useEffect(() => {
    const commandByKey: Record<string, MovementDirection> = {
      w: "FORWARD",
      a: "LEFT",
      s: "BACKWARD",
      d: "RIGHT",
      " ": "STOP",
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        disabled ||
        e.repeat ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const keyLower = e.key.toLowerCase();
      const command = commandByKey[keyLower];

      if (!command) return;

      e.preventDefault();

      const keyName = keyLower === " " ? "space" : keyLower;
      console.log(`[KEY DOWN] ${keyName} => ${command}`);

      activeKeyRef.current = keyLower;
      onMove(command, command === "STOP" ? 0 : 100);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (disabled) return;

      const keyLower = e.key.toLowerCase();
      const command = commandByKey[keyLower];

      if (!command) return;

      const keyName = keyLower === " " ? "space" : keyLower;

      if (keyLower === " ") {
        console.log(`[KEY UP] space => STOP`);
        return;
      }

      if (activeKeyRef.current === keyLower) {
        console.log(`[KEY UP] ${keyName} => STOP`);
        stop();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [disabled, onMove, stop]);

  return (
    <div className="flex flex-col items-center gap-5 select-none p-4 rounded-3xl bg-slate-950/60 backdrop-blur-xl border border-emerald-500/20 shadow-2xl">
      <div className="flex items-center justify-between w-full px-2 text-xs font-semibold tracking-wider text-emerald-400/80 uppercase">
        <span>Movement Matrix</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${disabled ? "bg-red-500" : "bg-emerald-400 animate-pulse"}`} />
          {disabled ? "Disabled" : "Active"}
        </span>
      </div>

      <div className="grid grid-cols-3 grid-rows-3 gap-3 p-2 bg-slate-900/80 rounded-2xl border border-slate-800" aria-label="Movement controls">
        {controls.map(({ command, label, keyLabel, icon: Icon, grid }) => {
          const isStop = command === "STOP";
          return (
            <button
              key={command}
              type="button"
              disabled={disabled}
              aria-label={label}
              onPointerDown={(e) => {
                e.preventDefault();
                console.log(`[BUTTON POINTER DOWN] ${command}`);
                onMove(command, isStop ? 0 : 100);
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                if (!isStop) {
                  console.log(`[BUTTON POINTER UP] STOP`);
                  stop();
                }
              }}
              onPointerCancel={() => {
                if (!isStop) stop();
              }}
              onPointerLeave={() => {
                if (!isStop) stop();
              }}
              className={[
                grid,
                "relative group flex flex-col items-center justify-center h-16 w-16 md:h-20 md:w-20 rounded-2xl border font-bold transition-all duration-150 active:scale-95",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100",
                isStop
                  ? "border-red-500/50 bg-gradient-to-br from-red-950/80 to-red-900/40 text-red-400 hover:border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.25)] active:from-red-900"
                  : "border-slate-700/80 bg-gradient-to-br from-slate-850 to-slate-900 text-emerald-400 hover:border-emerald-500/50 hover:bg-slate-800 shadow-lg active:from-slate-800",
              ].join(" ")}
            >
              <Icon className={`${isStop ? "h-7 w-7 text-red-400" : "h-7 w-7 text-emerald-400"} transition-transform group-hover:scale-110`} aria-hidden />
              <span className="text-[10px] font-mono mt-1 opacity-70 group-hover:opacity-100">{keyLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
        <span className="text-slate-500">KEYS:</span>
        {["W", "A", "S", "D"].map((key) => (
          <kbd
            key={key}
            className="rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-0.5 font-mono text-emerald-400 shadow-inner"
          >
            {key}
          </kbd>
        ))}
        <kbd className="ml-1 rounded-lg border border-red-900/40 bg-red-950/40 px-2 py-0.5 font-mono text-red-400 shadow-inner">
          SPACE: STOP
        </kbd>
      </div>
    </div>
  );
}
