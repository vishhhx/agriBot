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
    ? "#0891b2"              // cyan-600 when full
    : percent > 60
    ? "#059669"              // emerald-600
    : percent > 30
    ? "#d97706"              // amber-600
    : "#dc2626";             // red-600 when low

  return (
    <svg viewBox="0 0 96 96" className="h-full w-full" aria-hidden>
      {/* Track */}
      <circle
        cx={48} cy={48} r={38}
        fill="none"
        stroke="rgba(0,0,0,0.07)"
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
        className="font-extrabold"
        style={{
          fontSize: 16,
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
          fill: "#64748b",
          fontWeight: "700",
          letterSpacing: "0.05em",
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

  const refillDisabled = disabled || !connected || (isSensorActive && (tankFull || tankPercent >= 90) && !refillOn);

  return (
    <div
      id="water-pump-controller"
      className="flex flex-col gap-4 select-none rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm text-slate-800"
    >
      {/* ------------------------------------------------ Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-cyan-50 border border-cyan-100">
            <Waves size={16} className="text-cyan-600" aria-hidden />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            Water System
          </span>
        </div>

        {/* Connection badge */}
        {connected ? (
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-cyan-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            <WifiOff size={10} aria-hidden />
            Offline
          </span>
        )}
      </div>

      {/* ------------------------------------------------ Tank level */}
      <div className="flex items-center gap-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
        <div className="h-20 w-20 shrink-0">
          <TankArc percent={isSensorActive ? tankPercent : 0} tankFull={isSensorActive && (tankFull || tankPercent >= 90)} />
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            {!isSensorActive ? (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                Manual Mode
              </span>
            ) : tankFull || tankPercent >= 90 ? (
              <CheckCircle2 size={14} className="text-cyan-600" aria-hidden />
            ) : (
              <AlertTriangle size={14} className={tankPercent < 20 ? "text-red-500" : "text-amber-500"} aria-hidden />
            )}
            <span className={`font-bold ${isSensorActive && (tankFull || tankPercent >= 90) ? "text-cyan-700" : "text-slate-800"}`}>
              {!isSensorActive ? "Tank Sensor N/A" : tankFull || tankPercent >= 90 ? "Tank Full (90%+)" : "Tank Level"}
            </span>
          </div>

          {isSensorActive ? (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] text-slate-600 font-bold">
                {waterDistanceCm.toFixed(1)} cm depth
              </span>
              <span className="font-mono text-[10px] text-cyan-600 font-extrabold">
                {tankPercent}% Capacity Remaining
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-500">
              Sensor not detected — manual operation active.
            </span>
          )}

          <div className="flex gap-1.5 pt-0.5">
            {refillOn && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[9px] font-extrabold text-blue-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
                REFILLING
              </span>
            )}
            {sprayOn && (
              <span className="flex items-center gap-1 rounded-full bg-teal-100 border border-teal-200 px-2 py-0.5 text-[9px] font-extrabold text-teal-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-600" />
                SPRAYING
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ Pump buttons */}
      <div className="flex flex-col gap-2.5">

        {/* REFILL PUMP */}
        <button
          id="water-refill-btn"
          type="button"
          disabled={refillDisabled}
          aria-label={refillOn ? "Stop refill pump" : "Start refill pump"}
          onClick={() => onRefill(refillOn ? "OFF" : "ON")}
          className={[
            "group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-xs font-extrabold",
            "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            "disabled:cursor-not-allowed disabled:opacity-40",
            refillOn
              ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
              : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50",
          ].join(" ")}
        >
          <div className={`p-2 rounded-xl ${refillOn ? "bg-blue-600 text-white" : "bg-white text-slate-500 shadow-xs border border-slate-200"}`}>
            <RefreshCw
              size={15}
              className={refillOn ? "animate-spin" : ""}
              aria-hidden
            />
          </div>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-slate-900 font-bold">Refill Pump</span>
            <span className="text-[10px] font-semibold text-slate-400">
              Source → Tank
            </span>
          </span>
          <span
            className={[
              "ml-auto rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider",
              refillOn
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-200 text-slate-600",
            ].join(" ")}
          >
            {refillOn ? "ON" : "OFF"}
          </span>
        </button>

        {/* SPRAY PUMP */}
        <button
          id="water-spray-btn"
          type="button"
          disabled={disabled || !connected}
          aria-label={sprayOn ? "Stop spray pump" : "Start spray pump"}
          onClick={() => onSpray(sprayOn ? "OFF" : "ON")}
          className={[
            "group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-xs font-extrabold",
            "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
            "disabled:cursor-not-allowed disabled:opacity-40",
            sprayOn
              ? "border-teal-300 bg-teal-50 text-teal-700 shadow-sm"
              : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-teal-300 hover:bg-teal-50/50",
          ].join(" ")}
        >
          <div className={`p-2 rounded-xl ${sprayOn ? "bg-teal-600 text-white" : "bg-white text-slate-500 shadow-xs border border-slate-200"}`}>
            <Droplets
              size={15}
              className={sprayOn ? "animate-bounce" : ""}
              aria-hidden
            />
          </div>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-slate-900 font-bold">Spray Pump</span>
            <span className="text-[10px] font-semibold text-slate-400">
              Tank → Nozzle
            </span>
          </span>
          <span
            className={[
              "ml-auto rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider",
              sprayOn
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-200 text-slate-600",
            ].join(" ")}
          >
            {sprayOn ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {/* ------------------------------------------------ Safety note */}
      {(tankFull || tankPercent >= 90) && (
        <p className="rounded-xl border border-cyan-200 bg-cyan-50/80 px-3 py-2 text-[10px] font-semibold text-cyan-800 flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-cyan-600 shrink-0" />
          Refill pump blocked — tank at 90%+ capacity.
        </p>
      )}
      {!connected && (
        <p className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-[10px] font-semibold text-rose-800 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-rose-600 shrink-0" />
          Water ESP offline. Pumps locked for safety.
        </p>
      )}
    </div>
  );
}
