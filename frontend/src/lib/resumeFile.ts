export const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

/** Instant client-side check that mirrors the API's upload rules. The API stays authoritative. */
export function validateResumeFile(file: File | null): string | null {
  if (!file) return "Choose a file to upload.";
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
  if (!RESUME_EXTENSIONS.includes(extension)) return "Upload a PDF, DOC, or DOCX file.";
  if (file.size > RESUME_MAX_BYTES) return "File must be 5 MB or smaller.";
  return null;
}
