import { z } from "zod";
export const recurringIssueInput = z.object({
  title: z.string().trim().min(1).max(500),
  descriptionMarkdown: z.string().max(100000).default(""),
  type: z.enum(["task", "story", "bug"]).default("task"),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
  assigneeId: z.string().nullable().default(null),
  labelIds: z.array(z.string()).max(50).default([]),
});
export const recurringInput = z.object({
  name: z.string().trim().min(1).max(200),
  enabled: z.boolean().default(true),
  cadence: z.enum(["daily", "weekly", "monthly"]),
  nextRunAt: z.iso.datetime({ offset: true }),
  issue: recurringIssueInput,
});
export type RecurringInput = z.infer<typeof recurringInput>;
export type RecurringRule = RecurringInput & {
  id: string;
  version: number;
  anchorDay: number;
  lastCreatedAt: string | null;
  lastIssueId: string | null;
  lastError: string | null;
  createdAt: string;
};
export const slaPolicyInput = z
  .object({
    enabled: z.boolean(),
    responseMinutes: z.number().int().min(1).max(525600).nullable(),
    resolveMinutes: z.number().int().min(1).max(525600).nullable(),
  })
  .refine((v) => !v.enabled || v.responseMinutes !== null || v.resolveMinutes !== null, {
    message: "Set at least one target before enabling SLAs",
  });
export type SlaPolicy = z.infer<typeof slaPolicyInput> & { version: number; canManage: boolean };
export type SlaTarget = { dueAt: string; fulfilledAt: string | null };
export type IssueSla = { response: SlaTarget | null; resolve: SlaTarget | null; exempt: boolean };
export function slaState(target: SlaTarget | null, exempt: boolean, now = Date.now()) {
  if (!target) return "unset";
  if (exempt) return "exempt";
  const deadline = Date.parse(target.dueAt),
    fulfilled = target.fulfilledAt ? Date.parse(target.fulfilledAt) : null;
  if (fulfilled !== null) return fulfilled <= deadline ? "met" : "missed";
  return now > deadline ? "breached" : "on track";
}
/** First occurrence strictly after now, preserving the original monthly day through short months. */
export function nextRecurringDate(
  current: Date,
  cadence: RecurringInput["cadence"],
  now: Date = current,
  anchorDay = current.getUTCDate(),
) {
  const after = Math.max(current.getTime(), now.getTime());
  if (!Number.isFinite(after) || anchorDay < 1 || anchorDay > 31)
    throw new Error("Invalid schedule date");
  if (cadence !== "monthly") {
    const step = (cadence === "weekly" ? 7 : 1) * 86400000;
    return new Date(
      current.getTime() + (Math.floor((after - current.getTime()) / step) + 1) * step,
    );
  }
  const end = new Date(after);
  let month = end.getUTCFullYear() * 12 + end.getUTCMonth();
  function at(m: number) {
    const year = Math.floor(m / 12),
      mon = m % 12,
      last = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
    return new Date(
      Date.UTC(
        year,
        mon,
        Math.min(anchorDay, last),
        current.getUTCHours(),
        current.getUTCMinutes(),
        current.getUTCSeconds(),
        current.getUTCMilliseconds(),
      ),
    );
  }
  if (at(month).getTime() <= after) month++;
  return at(month);
}
export function issueSla(row: {
  type: string;
  statusCategory: string;
  responseDueAt: Date | null;
  resolveDueAt: Date | null;
  firstResponseAt: Date | null;
  completedAt: Date | null;
}): IssueSla | null {
  if (row.type !== "bug" || (!row.responseDueAt && !row.resolveDueAt)) return null;
  const resolved = row.statusCategory === "completed" ? row.completedAt : null;
  const response =
    row.firstResponseAt && resolved
      ? new Date(Math.min(row.firstResponseAt.getTime(), resolved.getTime()))
      : (row.firstResponseAt ?? resolved);
  return {
    exempt: row.statusCategory === "canceled",
    response: row.responseDueAt
      ? { dueAt: row.responseDueAt.toISOString(), fulfilledAt: response?.toISOString() ?? null }
      : null,
    resolve: row.resolveDueAt
      ? { dueAt: row.resolveDueAt.toISOString(), fulfilledAt: resolved?.toISOString() ?? null }
      : null,
  };
}
