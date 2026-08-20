"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isAxiosError } from "axios";
import { axiosInstance } from "@/utils/axios";

export interface User {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  services: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  error: null,
  refreshUser: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get<{ success: boolean; data: User }>(
        "/auth/me",
      );

      if (response.data.success) {
        setUser(response.data.data);
      } else {
        setUser(null);
      }
    } catch (requestError) {
      setUser(null);

      if (isAxiosError(requestError) && requestError.response?.status !== 401) {
        setError(requestError.response?.data?.message || "Unable to verify your session.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);

    try {
      await axiosInstance.post("/auth/logout");
    } catch (requestError) {
      setError(
        isAxiosError(requestError)
          ? requestError.response?.data?.message || "Unable to sign out."
          : "Unable to sign out.",
      );
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshUser();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      error,
      refreshUser,
      logout,
    }),
    [error, loading, refreshUser, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
