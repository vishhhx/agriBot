"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";
import { CloudShader } from "@/components/ui/cloud-shader";

export default function AuthSuccessPage() {
  const { refreshUser } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    const completeSignIn = async () => {
      await refreshUser();
      router.replace("/dashboard");
    };

    void completeSignIn();
  }, [refreshUser, router]);

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      {/* Cloud background */}
      <CloudShader className="absolute inset-0" />

      {/* Subtle overlay */}
      <div className="absolute inset-0 bg-slate-950/15" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-white/40 bg-white/15 text-sm font-semibold text-white shadow-lg backdrop-blur-md">
          A
        </div>

        {/* Brand */}
        <h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow-lg">
          AgriBot
        </h1>

        {/* Message */}
        <p className="mt-3 text-sm text-white/80 drop-shadow-md">
          Connecting you to your farm...
        </p>

        {/* Loader */}
        <div
          className="mt-7 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-label="Signing you in"
        />

        <p className="mt-4 text-xs tracking-wide text-white/60">
          Securely authenticating your account
        </p>
      </div>
    </main>
  );
}
