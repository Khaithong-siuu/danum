export const REPORT_REASONS = [
  { key: "spam", label: "Spam" },
  { key: "harassment", label: "Harassment or bullying" },
  { key: "hate", label: "Hate speech" },
  { key: "nudity", label: "Nudity or sexual content" },
  { key: "violence", label: "Violence or dangerous content" },
  { key: "self_harm", label: "Self-harm" },
  { key: "scam", label: "Scam or fraud" },
  { key: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];
export type ReportTarget = "post" | "comment" | "user";

export function isReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.key === value);
}