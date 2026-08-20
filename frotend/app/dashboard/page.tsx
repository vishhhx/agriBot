"use client";

import { useContext, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

export default function DashboardPage() {
  const { error, isAuthenticated, loading, logout, user } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-full items-center justify-center bg-slate-50 px-6 text-slate-900">
        <p className="text-sm text-slate-500">Loading your dashboard...</p>
      </main>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <main className="min-h-full bg-slate-50 px-6 py-8 text-slate-900 sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-medium text-emerald-700">AgriBot</p>
          <h1 className="mt-1 text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>

      {error ? (
        <p className="mx-auto mt-6 w-full max-w-5xl text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mx-auto mt-10 w-full max-w-5xl">
        <h2 className="text-lg font-semibold">Robot overview</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your connected robots and farm activity will appear here.
        </p>
        <Link
          href="/dashboard/mybots"
          className="mt-5 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          View my bots
        </Link>
      </section>
    </main>
  );
}
