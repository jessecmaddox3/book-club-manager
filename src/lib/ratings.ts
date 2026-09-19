import { z } from "zod";

const ratingBase = z.object({
  meetingId: z.string().uuid(),
  bookId: z.string().uuid(),
  revision: z.number().int().min(0),
});

export const ratingSubmissionSchema = z.discriminatedUnion("status", [
  ratingBase.extend({
    status: z.literal("read"),
    rating: z.number().int().min(1).max(5),
  }),
  ratingBase.extend({
    status: z.literal("did_not_read"),
    rating: z.null(),
  }),
  ratingBase.extend({
    status: z.literal("did_not_attend"),
    rating: z.null(),
  }),
  ratingBase.extend({status:z.literal('clear'),rating:z.null()}),
]);
