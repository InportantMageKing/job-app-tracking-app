import type { Source, Status } from "../api/types";

export const STATUSES: Status[] = ["applied", "phone_screen", "interview", "offer", "rejected", "withdrawn"];

export const STATUS_LABELS: Record<Status, string> = {
  applied: "Applied",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STATUS_COLORS: Record<Status, string> = {
  applied: "bg-slate-100 text-slate-700",
  phone_screen: "bg-sky-100 text-sky-800",
  interview: "bg-indigo-100 text-indigo-800",
  offer: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  withdrawn: "bg-amber-100 text-amber-800",
};

export const SOURCES: Source[] = ["linkedin", "indeed", "company_site", "referral", "other"];

export const SOURCE_LABELS: Record<Source, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  company_site: "Company Site",
  referral: "Referral",
  other: "Other",
};

/** Parse "YYYY-MM-DD" as a local calendar day (new Date("YYYY-MM-DD") would use UTC midnight). */
function parseDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function formatDay(day: string): string {
  return parseDay(day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDayShort(day: string): string {
  return parseDay(day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Today's date as "YYYY-MM-DD" in the user's time zone. */
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}
