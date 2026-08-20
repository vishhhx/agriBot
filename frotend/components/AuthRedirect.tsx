"use client";

import { useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

const AUTH_ROUTES = ["/login", "/register"];

export default function AuthRedirect() {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isAuthPage = AUTH_ROUTES.includes(pathname);

    // User is authenticated
    if (user && isAuthPage) {
      router.replace("/dashboard");
      return;
    }

    // User is not authenticated and trying to access dashboard
    if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/bot/"))) {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  return null;
}
