import { z } from "zod";

export const nominationSubmissionSchema = z.object({
  notes:z.string().trim().max(4000).optional(),
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  audiobookLength: z.string().trim().max(100).nullable().optional(),
  goodreadsRating: z.number().min(0).max(5).nullable().optional(),
});
