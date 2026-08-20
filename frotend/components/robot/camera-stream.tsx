"use client";

import { Video, VideoOff } from "lucide-react";

interface CameraStreamProps {
  frame: string | null;
  cameraConnected: boolean;
  /** When true the image fills its parent absolutely (game mode background) */
  fullscreen?: boolean;
}

export function CameraStream({
  frame,
  cameraConnected,
  fullscreen = false,
}: CameraStreamProps) {
  const base = fullscreen
    ? "absolute inset-0 h-full w-full"
    : "relative w-full overflow-hidden rounded-2xl aspect-video";

  return (
    <div className={`${base} bg-slate-100`}>
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frame}
          alt="Live camera feed"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {cameraConnected ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <p className="text-sm font-medium text-slate-500">Waiting for stream…</p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/60">
                <VideoOff size={28} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">Camera offline</p>
            </>
          )}
        </div>
      )}

      {/* LIVE pill */}
      <div className="absolute left-3 top-3">
        {cameraConnected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-500 backdrop-blur-sm shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-white/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-sm shadow-sm">
            <VideoOff size={10} />
            Offline
          </span>
        )}
      </div>
    </div>
  );
}
