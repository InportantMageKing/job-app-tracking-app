import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDownload, apiFetch } from "./client";
import type { ResumeVersion } from "./types";

export interface ResumeUpload {
  name: string;
  description: string;
  file: File;
}

export function useResumeVersions() {
  return useQuery({
    queryKey: ["resume-versions"],
    queryFn: () => apiFetch<ResumeVersion[]>("/resume-versions/"),
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description, file }: ResumeUpload) => {
      const form = new FormData();
      form.append("name", name);
      form.append("description", description);
      form.append("file", file);
      return apiFetch<ResumeVersion>("/resume-versions/", { method: "POST", body: form });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resume-versions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/resume-versions/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      // Applications that used this version now show no resume, so refresh them too.
      void queryClient.invalidateQueries({ queryKey: ["resume-versions"] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["application"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function downloadResume(resume: ResumeVersion): Promise<void> {
  return apiDownload(`/resume-versions/${resume.id}/file/`, resume.original_filename);
}
