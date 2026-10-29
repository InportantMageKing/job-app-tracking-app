import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { username } = useAuth();
  if (!username) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
