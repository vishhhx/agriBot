"use client";

import { isAxiosError } from "axios";
import { ArrowRight, Bot, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";
import { axiosInstance } from "@/utils/axios";

type BotStatus = "online" | "offline" | "idle" | "busy" | "maintenance";

interface MyBot {
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
  permissions: {
    view: boolean;
    control: boolean;
    configure: boolean;
    manageConnections: boolean;
  };
}

const statusStyles: Record<BotStatus, string> = {
  online: "bg-emerald-400",
  offline: "bg-slate-400",
  idle: "bg-sky-400",
  busy: "bg-amber-400",
  maintenance: "bg-rose-400",
};

export default function MyBotsPage() {
  const { isAuthenticated, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();
  const [bots, setBots] = useState<MyBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get<{ success: boolean; data: MyBot[] }>(
        "/robots/my-bots",
      );

      if (!response.data.success) {
        throw new Error("Unable to load your bots.");
      }

      setBots(response.data.data);
    } catch (requestError) {
      setBots([]);
      setError(
        isAxiosError(requestError)
          ? requestError.response?.data?.message || "Unable to load your bots."
          : requestError instanceof Error
            ? requestError.message
            : "Unable to load your bots.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated) {
      const loadTimer = window.setTimeout(() => {
        void loadBots();
      }, 0);

      return () => window.clearTimeout(loadTimer);
    }
  }, [authLoading, isAuthenticated, loadBots, router]);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-full items-center justify-center bg-slate-50 px-6 text-slate-900">
        <p className="text-sm text-slate-500">Loading your bots...</p>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 px-6 py-8 text-slate-900 sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-5 border-b border-slate-200 pb-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
            AgriBot
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">My bots</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadBots()}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100"
          aria-label="Refresh bots"
          title="Refresh bots"
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <div className="mx-auto mt-6 w-full max-w-5xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadBots()} className="mt-2 font-medium underline underline-offset-4">
            Try again
          </button>
        </div>
      ) : null}

      {!error && bots.length === 0 ? (
        <section className="mx-auto flex min-h-64 w-full max-w-5xl flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-6 text-center">
          <Bot size={30} className="text-slate-400" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">No bots available</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Bots shared with your account will appear here.
          </p>
        </section>
      ) : null}

      {bots.length > 0 ? (
        <section className="mx-auto mt-8 grid w-full max-w-5xl gap-4 sm:grid-cols-2">
          {bots.map((bot) => (
            <article key={bot.robotId} className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{bot.name}</h2>
                  <p className="mt-1 truncate text-sm text-slate-500">{bot.robotId}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-xs capitalize text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${statusStyles[bot.status]}`} />
                  {bot.status}
                </span>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                <div>
                  <dt className="text-slate-500">Model</dt>
                  <dd className="mt-1 text-slate-900">{bot.model.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Firmware</dt>
                  <dd className="mt-1 text-slate-900">{bot.firmwareVersion}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Access</dt>
                  <dd className="mt-1 capitalize text-slate-900">{bot.role}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Control</dt>
                  <dd className="mt-1 text-slate-900">{bot.permissions.control ? "Allowed" : "View only"}</dd>
                </div>
              </dl>
              <Link
                href={`/bot/${encodeURIComponent(bot.robotId)}`}
                className="mt-6 flex h-10 items-center justify-center gap-2 border border-slate-300 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                View bot
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
