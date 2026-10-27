import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { Application, Source, Status } from "./types";

export interface ApplicationFilters {
  status?: Status | "";
  source?: Source | "";
  search?: string;
}

export function applicationsPath(filters: ApplicationFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/applications/?${query}` : "/applications/";
}

export function useApplications(filters: ApplicationFilters) {
  return useQuery({
    queryKey: ["applications", filters],
    queryFn: () => apiFetch<Application[]>(applicationsPath(filters)),
    // Keep the old rows on screen while a new filter loads, instead of flashing "Loading".
    placeholderData: keepPreviousData,
  });
}
