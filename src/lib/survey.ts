import { z } from "zod";
import {ratingSubmissionSchema} from './ratings';
export type ActiveBallot={id:string;surveyId:string;revision:number;status:'draft'|'open'|'closed';bookIds:string[];dateIds:string[]};

const RATING_MESSAGE = "Every rating must be a whole number from 1 to 5.";
const CLOSED_MESSAGE = "This ballot has closed.";

const ratingValueSchema = z
  .number({ error: RATING_MESSAGE })
  .int({ error: RATING_MESSAGE })
  .min(1, { error: RATING_MESSAGE })
  .max(5, { error: RATING_MESSAGE });

const datePreferenceValueSchema = z.enum(["yes", "maybe", "no"], {
  error: "Date answers must be yes, maybe, or no.",
});

// Leaf shapes are validated by zod; the exact key sets (all ballot books, only
// ballot dates) are checked by hand below so the messages stay plain.
export const surveySubmissionSchema = z.object({
  surveyId: z.string({ error: CLOSED_MESSAGE }),
  ballotId:z.uuid(),ballotRevision:z.number().int().positive(),responseRevision:z.number().int().min(0),
  verdictChange:ratingSubmissionSchema.optional(),
  ratings: z.record(z.string(), ratingValueSchema, {
    error: "Your ratings are missing.",
  }),
  willingToHost: z
    .boolean({ error: "The host answer must be true or false." })
    .default(false),
  willingToBringBourbon: z
    .boolean({ error: "The beverage answer must be true or false." })
    .default(false),
  datePreferences: z
    .record(z.string(), datePreferenceValueSchema, {
      error: "Your date preferences look malformed.",
    })
    .default({}),
});

export type SurveySubmission = z.infer<typeof surveySubmissionSchema>;

export type SurveyValidationResult =
  | { ok: true; data: SurveySubmission }
  | { ok: false; status: 400 | 409; error: string };

export function validateSurveySubmission(
  body: unknown,
  ballot: ActiveBallot
): SurveyValidationResult {
  // Global gate: nothing is accepted once voting is closed.
  if (ballot.status !== "open") {
    return { ok: false, status: 409, error: CLOSED_MESSAGE };
  }

  // Stale-tab replay protection: a ballot must target the active survey.
  const surveyId = (body as { surveyId?: unknown } | null | undefined)?.surveyId;
  const target=body as {ballotId?:unknown;ballotRevision?:unknown}|null;
  if (surveyId !== ballot.surveyId||target?.ballotId!==ballot.id||target?.ballotRevision!==ballot.revision) {
    return { ok: false, status: 409, error: CLOSED_MESSAGE };
  }

  const BOOK_IDS = ballot.bookIds;
  const BOOK_ID_SET = new Set(BOOK_IDS);
  const DATE_ID_SET = new Set(ballot.dateIds);

  const parsed = surveySubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message ?? "Your ballot looks malformed.",
    };
  }

  const data = parsed.data;

  // ratings keys must be exactly the ballot books: every one present, no extras.
  for (const id of BOOK_IDS) {
    if (!(id in data.ratings)) {
      return { ok: false, status: 400, error: "Rate every book on the ballot." };
    }
  }
  for (const key of Object.keys(data.ratings)) {
    if (!BOOK_ID_SET.has(key)) {
      return {
        ok: false,
        status: 400,
        error: "That vote includes a book that isn't on the ballot.",
      };
    }
  }

  // datePreferences keys must be a subset of the ballot dates.
  for (const key of Object.keys(data.datePreferences)) {
    if (!DATE_ID_SET.has(key)) {
      return {
        ok: false,
        status: 400,
        error: "That vote includes a date that isn't on the ballot.",
      };
    }
  }

  return { ok: true, data };
}
