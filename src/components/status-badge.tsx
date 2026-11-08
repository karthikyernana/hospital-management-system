import { Badge, type Tone } from "./ui";
import { titleCase } from "@/lib/format";

const TONES: Record<string, Tone> = {
  SCHEDULED: "blue",
  CHECKED_IN: "violet",
  COMPLETED: "green",
  CANCELLED: "gray",
  NO_SHOW: "amber",
  OPEN: "amber",
  FINALIZED: "green",
  DRAFT: "gray",
  ISSUED: "blue",
  PAID: "green",
  VOID: "red",
  PENDING: "amber",
  SUCCEEDED: "green",
  FAILED: "red",
  ORDERED: "amber",
  RESULTED: "green",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONES[status] ?? "gray"}>{titleCase(status)}</Badge>;
}
