export function formatTimestamp(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function severityColor(severity: number): string {
  if (severity >= 0.7) return "bg-red-500";
  if (severity >= 0.4) return "bg-amber-500";
  return "bg-emerald-500";
}

export function severityLabel(severity: "low" | "medium" | "high"): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
