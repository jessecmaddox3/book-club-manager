import { z } from "zod";
import { isCalendarDate } from "./dates";

// The JSON a ballot is built from (scripts/cycle.ts build <file>). Written by
// the shortlist step, checked here so a typo fails before anything is written.

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase words joined by hyphens");

const isoDate = z.string().refine(isCalendarDate, "date must be a real calendar date in YYYY-MM-DD format");

export const nomineeDefinitionSchema = z.object({
  slug,
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(300).nullable().default(null),
  author: z.string().trim().min(1).max(200),
  recommendedBy: z.string().trim().min(1), // member full_name, display_name, or nickname
  description: z.string().trim().min(1).max(2000),
  caseFor: z.string().trim().min(1).max(1000),
  caseAgainst: z.string().trim().min(1).max(1000),
  coverImage: z.string().trim().min(1).nullable().default(null),
  pages: z.number().int().positive().nullable().default(null),
  audiobookLength: z.string().trim().max(100).nullable().default(null),
  goodreadsRating: z.number().min(0).max(5).nullable().default(null),
  // Record where each factual page count, award or other claim was checked.
  sources: z
    .array(z.object({ claim: z.string().min(1), url: z.string().min(1), note: z.string().optional() }))
    .default([]),
});

export const ballotDefinitionSchema = z
  .object({
    meetingNumber: z.number().int().positive(),
    previousMeetingId: z.string().uuid().nullable().optional(),
    dates: z.array(isoDate).min(1),
    nominees: z.array(nomineeDefinitionSchema).min(2),
  })
  .superRefine((def, ctx) => {
    const slugs = new Set<string>();
    for (const n of def.nominees) {
      if (slugs.has(n.slug)) {
        ctx.addIssue({ code: "custom", message: `duplicate slug "${n.slug}"` });
      }
      slugs.add(n.slug);
    }
    const dates = new Set<string>();
    for (const d of def.dates) {
      if (dates.has(d)) ctx.addIssue({ code: "custom", message: `duplicate date "${d}"` });
      dates.add(d);
    }
    const longest = Math.max(...def.nominees.map((n) => n.pages ?? 0));
    for (const n of def.nominees) {
      const claimsLongest = /\blongest\b/i.test(n.caseAgainst + " " + n.caseFor + " " + n.description);
      if (claimsLongest && (n.pages ?? 0) < longest) {
        ctx.addIssue({
          code: "custom",
          message: `"${n.title}" says "longest" but ${longest} pages is on the ballot`,
        });
      }
    }
  });

export type BallotDefinition = z.infer<typeof ballotDefinitionSchema>;
export type NomineeDefinition = z.infer<typeof nomineeDefinitionSchema>;
