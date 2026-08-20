"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { CloudShader } from "@/components/ui/cloud-shader";
import { AuthContext } from "@/context/AuthContext";

export default function AgriBotHero() {
  const router = useRouter();
  const { user, loading, isAuthenticated } = useContext(AuthContext);

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Cloud background */}
      <CloudShader className="absolute inset-0" />

      {/* Subtle overlay */}
      <div className="absolute inset-0 bg-black/[0.08]" />

      {/* Navbar */}
      <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        {/* Logo */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-3 text-white"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/50 bg-white/10 text-sm font-semibold backdrop-blur-sm">
            A
          </div>

          <span className="text-lg font-semibold tracking-tight">AgriBot</span>
        </button>

        {/* Navigation */}
        <div className="hidden items-center gap-8 text-sm text-white/80 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>

          <a
            href="#how-it-works"
            className="transition-colors hover:text-white"
          >
            How it works
          </a>

          <a href="#robots" className="transition-colors hover:text-white">
            Robots
          </a>

          <a href="#docs" className="transition-colors hover:text-white">
            Documentation
          </a>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-white/10" />
          ) : isAuthenticated ? (
            <>
              <span className="hidden text-sm text-white/75 sm:block">
                {user?.name}
              </span>

              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90"
              >
                Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="hidden text-sm font-medium text-white/80 transition-colors hover:text-white sm:block"
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => router.push("/register")}
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90"
              >
                Get started
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 text-center md:pt-28 lg:pt-32">
        {/* Small label */}
        <p className="mb-6 text-sm font-medium tracking-wide text-white/80">
          Cloud-connected agricultural robotics
        </p>

        {/* Heading */}
        <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white drop-shadow-lg sm:text-6xl md:text-7xl lg:text-8xl">
          Control your farm
          <br />
          from anywhere.
        </h1>

        {/* Description */}
        <p className="mt-7 max-w-2xl text-base leading-7 text-white/80 drop-shadow-md sm:text-lg md:text-xl">
          AgriBot connects your agricultural robot to the cloud, giving you
          real-time control and monitoring wherever you are.
        </p>

        {/* Buttons */}
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          {loading ? (
            <div className="h-11 w-44 animate-pulse rounded-full bg-white/20" />
          ) : isAuthenticated ? (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-slate-800 shadow-xl transition-all hover:-translate-y-0.5 hover:bg-white/90"
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/register")}
                className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-slate-800 shadow-xl transition-all hover:-translate-y-0.5 hover:bg-white/90"
              >
                Connect your robot
              </button>

              <a
                href="#how-it-works"
                className="rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/20"
              >
                Learn how it works
              </a>
            </>
          )}
        </div>

        {/* Supporting text */}
        <p className="mt-5 text-xs tracking-wide text-white/60">
          Real-time control · Secure connection · Access from anywhere
        </p>
      </section>
    </main>
  );
}
