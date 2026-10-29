import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { apiFetch, jsonBody, setUnauthorizedHandler, tokenStore } from "../api/client";
import type { AuthResponse } from "../api/types";

interface AuthState {
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => tokenStore.getUsername());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const endSession = useCallback(() => {
    tokenStore.clear();
    setUsername(null);
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(endSession);
  }, [endSession]);

  const authenticate = useCallback(async (path: string, name: string, password: string) => {
    const data = await apiFetch<AuthResponse>(path, {
      method: "POST",
      body: jsonBody({ username: name, password }),
    });
    tokenStore.set(data.token, data.username);
    setUsername(data.username);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      username,
      login: (name, password) => authenticate("/auth/login/", name, password),
      signup: (name, password) => authenticate("/auth/signup/", name, password),
      logout: async () => {
        try {
          await apiFetch<void>("/auth/logout/", { method: "POST" });
        } catch {
          // The token may already be invalid; logging out locally is what matters.
        }
        endSession();
      },
    }),
    [username, authenticate, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
