import { z } from "zod";
import type { AnalysisRequest } from "@/lib/types";

const schema = z
  .object({
    location: z
      .string()
      .trim()
      .min(1, "Location is required.")
      .max(200, "Location must be 200 characters or fewer."),
    fieldOfStudy: z
      .string()
      .trim()
      .min(1, "Field of study is required.")
      .max(120, "Field of study must be 120 characters or fewer."),
    mode: z.enum(["opportunity", "improve"]),
    existingBusinessType: z
      .string()
      .trim()
      .max(120, "Business type must be 120 characters or fewer.")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.mode === "improve") {
        return !!data.existingBusinessType && data.existingBusinessType.length > 0;
      }
      return true;
    },
    {
      message:
        "Please specify your business type when using the improve mode.",
      path: ["existingBusinessType"],
    },
  );

export function parseAnalysisRequest(
  input: unknown,
): { success: true; data: AnalysisRequest } | { success: false; error: string } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as AnalysisRequest };
  }
  const message = result.error.issues.map((i) => i.message).join(" ");
  return { success: false, error: message };
}
