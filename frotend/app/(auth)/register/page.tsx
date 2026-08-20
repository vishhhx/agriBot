import { Suspense } from "react";
import GoogleAuth from "@/components/GoogleAuth";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <GoogleAuth mode="register" />
    </Suspense>
  );
}
