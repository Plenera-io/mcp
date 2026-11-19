import { z } from "zod";
export const CUSTOM_FIELD_TYPES = ["select", "number", "date", "person"] as const;
export const customFieldInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(CUSTOM_FIELD_TYPES),
    options: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    archived: z.boolean().default(false),
  })
  .superRefine((v, c) => {
    if (v.type === "select" && !v.options.length)
      c.addIssue({ code: "custom", path: ["options"], message: "Add at least one option" });
    if (new Set(v.options).size !== v.options.length)
      c.addIssue({ code: "custom", path: ["options"], message: "Options must be unique" });
    if (v.type !== "select" && v.options.length)
      c.addIssue({ code: "custom", path: ["options"], message: "Only select fields have options" });
  });
export const customFieldValues = z
  .record(z.string().min(1).max(100), z.union([z.string().max(1000), z.number(), z.null()]))
  .refine((v) => Object.keys(v).length <= 50, "At most 50 fields per update");
export type CustomFieldInput = z.infer<typeof customFieldInput>;
export type CustomFieldValue = string | number;
export type CustomField = CustomFieldInput & { id: string; version: number };
export const ISSUE_TEMPLATE_IDS = ["bug", "feature", "spec"] as const;
const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value = "") => ({ type: "paragraph", content: value ? [text(value)] : [] });
function templateDoc(sections: readonly string[]) {
  return {
    type: "doc" as const,
    content: sections.flatMap((name) => [
      { type: "heading", attrs: { level: 2 }, content: [text(name)] },
      name === "Acceptance criteria"
        ? {
            type: "taskList",
            content: [{ type: "taskItem", attrs: { checked: false }, content: [paragraph()] }],
          }
        : paragraph(),
    ]),
  };
}
export const ISSUE_TEMPLATES = [
  {
    id: "bug" as const,
    name: "Bug report",
    type: "bug" as const,
    sections: ["Steps to reproduce", "Expected behavior", "Actual behavior", "Acceptance criteria"],
  },
  {
    id: "feature" as const,
    name: "Feature",
    type: "story" as const,
    sections: ["Problem", "Proposal", "Acceptance criteria"],
  },
  {
    id: "spec" as const,
    name: "Specification",
    type: "task" as const,
    sections: ["Context", "Requirements", "Implementation plan", "Acceptance criteria"],
  },
].map((t) => ({ ...t, description: templateDoc(t.sections) }));
export function templateById(id: string) {
  return ISSUE_TEMPLATES.find((t) => t.id === id);
}
