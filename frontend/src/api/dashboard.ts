import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { DashboardStats } from "./types";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardStats>("/dashboard/stats/"),
  });
}
