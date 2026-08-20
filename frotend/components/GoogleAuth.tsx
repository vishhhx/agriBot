"use client";

import { isAxiosError } from "axios";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudShader } from "@/components/ui/cloud-shader";
import { axiosInstance } from "@/utils/axios";

type GoogleAuthProps = {
  mode?: "login" | "register";
};

export default function GoogleAuth({ mode = "login" }: GoogleAuthProps) {
  const isLogin = mode === "login";
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oauthError = searchParams.get("error");

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get<{ success: boolean; data: string }>(
        "/auth/google",
      );

      if (!response.data.success || !response.data.data) {
        throw new Error("Google sign-in could not be started.");
      }

      window.location.assign(response.data.data);
    } catch (requestError) {
      setError(
        isAxiosError(requestError)
          ? requestError.response?.data?.message || "Unable to start Google sign-in."
          : requestError instanceof Error
            ? requestError.message
            : "Unable to start Google sign-in.",
      );

      console.error("Google sign-in error:", requestError);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <CloudShader className="absolute inset-0" />

      {/* Dark subtle overlay */}
      <div className="absolute inset-0 bg-slate-950/10" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="rounded-2xl border border-white/30 bg-slate-900/25 p-8 shadow-2xl backdrop-blur-xl">
          {/* Brand */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-white/40 bg-white/10 text-sm font-semibold text-white">
              A
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white">
              AgriBot
            </h1>
          </div>

          {/* Heading */}
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              {isLogin ? "Welcome back" : "Welcome to AgriBot"}
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/85">
              {isLogin
                ? "Sign in to access your robots and monitor your farm from anywhere."
                : "Create your account and connect your agricultural robot to the cloud."}
            </p>
          </div>

          {/* Google button */}
          <button
            type="button"
            aria-label="Continue with Google"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-800 shadow-lg transition-all hover:bg-slate-50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900/50 active:scale-[0.99]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M21.805 12.23c0-.79-.07-1.55-.22-2.28H12v4.32h5.49a4.69 4.69 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.055-4.4 3.055-7.68Z"
                fill="#4285F4"
              />
              <path
                d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.3-2.56c-.91.61-2.07.97-3.47.97-2.67 0-4.93-1.8-5.74-4.22H2.85v2.64A10.23 10.23 0 0 0 12 22Z"
                fill="#34A853"
              />
              <path
                d="M6.26 13.72A6.14 6.14 0 0 1 5.94 12c0-.6.11-1.18.32-1.72V7.64H2.85A10 10 0 0 0 1.78 12c0 1.57.38 3.05 1.07 4.36l3.41-2.64Z"
                fill="#FBBC05"
              />
              <path
                d="M12 6.06c1.5 0 2.85.52 3.91 1.54l2.93-2.93C17.07 2.99 14.76 2 12 2a10.23 10.23 0 0 0-9.15 5.64l3.41 2.64C7.07 7.86 9.33 6.06 12 6.06Z"
                fill="#EA4335"
              />
            </svg>
            {isLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>

          {error || oauthError ? (
            <p className="mt-4 text-center text-sm text-red-100" role="alert">
              {error || oauthError}
            </p>
          ) : null}

          {/* Terms */}
          <p className="mt-6 text-center text-xs leading-5 text-white/65">
            By continuing, you agree to AgriBot&apos;s{" "}
            <a
              href="/terms"
              className="text-white/85 underline underline-offset-2 hover:text-white"
            >
              terms of service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-white/85 underline underline-offset-2 hover:text-white"
            >
              privacy policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
