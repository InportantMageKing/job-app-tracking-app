import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, jsonBody } from "./client";
import type { Application, ApplicationInput, Source, Status } from "./types";

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

export function toApplicationInput(application: Application): ApplicationInput {
  return {
    company: application.company,
    job_title: application.job_title,
    source: application.source,
    link: application.link,
    date_applied: application.date_applied,
    location: application.location,
    salary_range: application.salary_range,
    contact_person: application.contact_person,
    resume_version: application.resume_version,
  };
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      apiFetch<Application>("/applications/", { method: "POST", body: jsonBody(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["resume-versions"] });
    },
  });
}

export function useUpdateApplication(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      apiFetch<Application>(`/applications/${id}/`, { method: "PATCH", body: jsonBody(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["application", id] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["resume-versions"] });
    },
  });
}
