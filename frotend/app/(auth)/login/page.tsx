import { Suspense } from "react";
import GoogleAuth from "@/components/GoogleAuth";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <GoogleAuth mode="login" />
    </Suspense>
  );
}
