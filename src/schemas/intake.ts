import { z } from "zod";
export const intakeSubmission = z.object({
  title: z.string().trim().min(1).max(500),
  details: z.string().trim().max(20000).default(""),
  reporterEmail: z.string().trim().email().max(254).nullable().optional(),
});
export const intakeReview = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(500).optional(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  labelIds: z.array(z.string()).max(50).optional(),
  duplicateIssueId: z.string().nullable().optional(),
  note: z.string().trim().max(5000).optional(),
  state: z.enum(["pending", "needs_info"]).optional(),
  decision: z.enum(["accept", "decline"]).optional(),
});
