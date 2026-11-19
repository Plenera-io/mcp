import { z } from "zod";
export const documentWrite = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.unknown().optional(),
  bodyMarkdown: z.string().max(100000).optional(),
  archived: z.boolean().optional(),
});
export const specIssueBatch = z.object({
  version: z.number().int().positive(),
  titles: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
});
