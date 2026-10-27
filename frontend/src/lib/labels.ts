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

export const STATUS_LINE: Record<Status, string> = {
  applied: "bg-line-applied",
  phone_screen: "bg-line-phone_screen",
  interview: "bg-line-interview",
  offer: "bg-line-offer",
  rejected: "bg-line-rejected",
  withdrawn: "bg-line-withdrawn",
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
