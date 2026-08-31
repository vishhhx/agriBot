"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  RefreshCw,
  Waves,
  WifiOff,
} from "lucide-react";
import type { WaterPumpState } from "@/lib/robot-events";

// =====================================================
// PROPS
// =====================================================

interface WaterPumpControllerProps {
  disabled: boolean;
  connected: boolean;          // WATER_PUMP ESP32 connected?
  refillOn: boolean;
  sprayOn: boolean;
  tankFull: boolean;
  waterDistanceCm: number | null;
  waterPercent?: number | null;
  sensorPresent?: boolean;
  onRefill: (state: WaterPumpState) => void;
  onSpray: (state: WaterPumpState) => void;
}

// =====================================================
// TANK LEVEL ARC
// Tank sensor sits at top; closer distance = fuller.
// TANK_FULL_DISTANCE_CM = 5.08 (2 inches)
// Reasonable "empty" ceiling is 40 cm.
// =====================================================

const FULL_CM  = 5.08;
const EMPTY_CM = 40;

function distanceToPercent(cm: number | null, givenPercent?: number | null): number {
  if (givenPercent !== undefined && givenPercent !== null && givenPercent >= 0) {
    return Math.min(Math.max(givenPercent, 0), 100);
  }
  if (cm === null || cm < 0) return 0;
  if (cm <= FULL_CM) return 100;
  if (cm >= EMPTY_CM) return 0;
  return Math.round(((EMPTY_CM - cm) / (EMPTY_CM - FULL_CM)) * 100);
}

// SVG arc helpers
function arcPath(percent: number, r = 38, cx = 48, cy = 48): string {
  if (percent <= 0) return "";
  const clamped = Math.min(percent, 99.99);          // avoid full-circle degenerate
  const angle   = (clamped / 100) * 360 - 90;        // start from top
  const rad     = (angle * Math.PI) / 180;
  const x       = cx + r * Math.cos(rad);
  const y       = cy + r * Math.sin(rad);
  const large   = clamped > 50 ? 1 : 0;
  // Start point: top of circle (cx, cy - r)
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
}

function TankArc({ percent, tankFull }: { percent: number; tankFull: boolean }) {
  const colour = tankFull
    ? "#22d3ee"              // cyan when full
    : percent > 60
    ? "#34d399"              // emerald
    : percent > 30
    ? "#facc15"              // yellow
    : "#f87171";             // red when low

  return (
    <svg viewBox="0 0 96 96" className="h-full w-full" aria-hidden>
      {/* Track */}
      <circle
        cx={48} cy={48} r={38}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={8}
      />
      {/* Progress */}
      {percent > 0 && (
        <path
          d={percent >= 100 ? undefined : arcPath(percent)}
          fill="none"
          stroke={colour}
          strokeWidth={8}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      )}
      {percent >= 100 && (
        <circle
          cx={48} cy={48} r={38}
          fill="none"
          stroke={colour}
          strokeWidth={8}
        />
      )}
      {/* Center label */}
      <text
        x={48} y={44}
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-bold"
        style={{
          fontSize: 15,
          fill: colour,
          fontFamily: "monospace",
        }}
      >
        {percent}%
      </text>
      <text
        x={48} y={60}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: 8,
          fill: "rgba(255,255,255,0.5)",
          fontFamily: "monospace",
        }}
      >
        TANK
      </text>
    </svg>
  );
}

// =====================================================
// COMPONENT
// =====================================================

export function WaterPumpController({
  disabled,
  connected,
  refillOn,
  sprayOn,
  tankFull,
  waterDistanceCm,
  waterPercent,
  sensorPresent = true,
  onRefill,
  onSpray,
}: WaterPumpControllerProps) {
  const isSensorActive = sensorPresent && waterDistanceCm !== null && waterDistanceCm >= 0;
  const tankPercent = isSensorActive ? distanceToPercent(waterDistanceCm, waterPercent) : 0;

  const refillDisabled = disabled || !connected || (isSensorActive && tankFull && !refillOn);

  return (
    <div
      id="water-pump-controller"
      className="flex flex-col gap-4 select-none rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-xl"
    >
      {/* ------------------------------------------------ Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves size={15} className="text-cyan-400" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
            Water System
          </span>
        </div>

        {/* Connection badge */}
        {connected ? (
          <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-900/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            <WifiOff size={9} aria-hidden />
            Offline
          </span>
        )}
      </div>

      {/* ------------------------------------------------ Tank level */}
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0">
          <TankArc percent={isSensorActive ? tankPercent : 0} tankFull={isSensorActive && tankFull} />
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            {!isSensorActive ? (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                Sensor N/A (Manual Mode)
              </span>
            ) : tankFull ? (
              <CheckCircle2 size={12} className="text-cyan-400" aria-hidden />
            ) : (
              <AlertTriangle size={12} className={tankPercent < 20 ? "text-red-400" : "text-yellow-400"} aria-hidden />
            )}
            <span className={`font-semibold ${isSensorActive && tankFull ? "text-cyan-300" : "text-slate-300"}`}>
              {!isSensorActive ? "Tank Status" : tankFull ? "Tank Full (<= 2 in)" : "Tank Level"}
            </span>
          </div>

          {isSensorActive ? (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] text-slate-300 font-bold">
                {waterDistanceCm.toFixed(1)} cm / {(waterDistanceCm / 2.54).toFixed(1)} in depth
              </span>
              <span className="font-mono text-[9px] text-cyan-400/90">
                {tankPercent}% Capacity Remaining
              </span>
            </div>
          ) : (
            <span className="font-mono text-[10px] text-slate-500">
              Ultrasonic sensor not detected — pumps enabled manually.
            </span>
          )}

          <div className="flex gap-1.5 pt-0.5">
            {refillOn && (
              <span className="flex items-center gap-1 rounded-full bg-blue-900/40 px-2 py-0.5 text-[9px] font-bold text-blue-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                REFILLING
              </span>
            )}
            {sprayOn && (
              <span className="flex items-center gap-1 rounded-full bg-teal-900/40 px-2 py-0.5 text-[9px] font-bold text-teal-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                SPRAYING
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ Divider */}
      <div className="h-px bg-white/5" />

      {/* ------------------------------------------------ Pump buttons */}
      <div className="flex flex-col gap-2">

        {/* REFILL PUMP */}
        <button
          id="water-refill-btn"
          type="button"
          disabled={refillDisabled}
          aria-label={refillOn ? "Stop refill pump" : "Start refill pump"}
          onClick={() => onRefill(refillOn ? "OFF" : "ON")}
          className={[
            "group relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 text-sm font-semibold",
            "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
            "disabled:cursor-not-allowed disabled:opacity-30",
            refillOn
              ? "border-blue-500/50 bg-blue-600/20 text-blue-300 shadow-[0_0_18px_rgba(59,130,246,0.2)]"
              : "border-slate-700/80 bg-slate-800/60 text-slate-300 hover:border-blue-600/40 hover:bg-slate-800",
          ].join(" ")}
        >
          <RefreshCw
            size={16}
            className={refillOn ? "text-blue-400 animate-spin" : "text-slate-400"}
            aria-hidden
          />
          <span className="flex flex-col items-start leading-tight">
            <span>Refill Pump</span>
            <span className="text-[9px] font-normal opacity-60">
              Source → Tank
            </span>
          </span>
          <span
            className={[
              "ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
              refillOn
                ? "bg-blue-500/20 text-blue-300"
                : "bg-slate-700 text-slate-400",
            ].join(" ")}
          >
            {refillOn ? "ON" : "OFF"}
          </span>

          {/* Ripple effect when active */}
          {refillOn && (
            <span className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-blue-500/5" />
          )}
        </button>

        {/* SPRAY PUMP */}
        <button
          id="water-spray-btn"
          type="button"
          disabled={disabled || !connected}
          aria-label={sprayOn ? "Stop spray pump" : "Start spray pump"}
          onClick={() => onSpray(sprayOn ? "OFF" : "ON")}
          className={[
            "group relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 text-sm font-semibold",
            "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
            "disabled:cursor-not-allowed disabled:opacity-30",
            sprayOn
              ? "border-teal-500/50 bg-teal-600/20 text-teal-300 shadow-[0_0_18px_rgba(20,184,166,0.2)]"
              : "border-slate-700/80 bg-slate-800/60 text-slate-300 hover:border-teal-600/40 hover:bg-slate-800",
          ].join(" ")}
        >
          <Droplets
            size={16}
            className={sprayOn ? "text-teal-400 animate-bounce" : "text-slate-400"}
            aria-hidden
          />
          <span className="flex flex-col items-start leading-tight">
            <span>Spray Pump</span>
            <span className="text-[9px] font-normal opacity-60">
              Tank → Nozzle
            </span>
          </span>
          <span
            className={[
              "ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
              sprayOn
                ? "bg-teal-500/20 text-teal-300"
                : "bg-slate-700 text-slate-400",
            ].join(" ")}
          >
            {sprayOn ? "ON" : "OFF"}
          </span>

          {sprayOn && (
            <span className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-teal-500/5" />
          )}
        </button>
      </div>

      {/* ------------------------------------------------ Safety note */}
      {tankFull && (
        <p className="rounded-lg border border-cyan-500/20 bg-cyan-900/20 px-3 py-2 text-[10px] text-cyan-300">
          🛡 Refill pump blocked — tank is full. Spray pump remains available.
        </p>
      )}
      {!connected && (
        <p className="rounded-lg border border-red-500/20 bg-red-900/20 px-3 py-2 text-[10px] text-red-300">
          ⚠ Water pump module offline. Both pumps locked for safety.
        </p>
      )}
    </div>
  );
}
