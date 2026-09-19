import assert from "node:assert/strict";
import test from "node:test";
import { ratingSubmissionSchema } from "../src/lib/ratings";

const bookId="00000000-0000-4000-8000-000000000002",revision=0;
const meetingId = "00000000-0000-4000-8000-000000000001";

test("accepts a read status with a 1 to 5 rating", () => {
  assert.equal(
    ratingSubmissionSchema.safeParse({ bookId,revision,meetingId, status: "read", rating: 5 })
      .success,
    true
  );
});

test("rejects a read status without a rating", () => {
  assert.equal(
    ratingSubmissionSchema.safeParse({ bookId,revision,meetingId, status: "read", rating: null })
      .success,
    false
  );
});

test("accepts skipped statuses only with a null rating", () => {
  assert.equal(
    ratingSubmissionSchema.safeParse({
      bookId,revision,meetingId,
      status: "did_not_read",
      rating: null,
    }).success,
    true
  );
  assert.equal(
    ratingSubmissionSchema.safeParse({
      bookId,revision,meetingId,
      status: "did_not_attend",
      rating: null,
    }).success,
    true
  );
  assert.equal(
    ratingSubmissionSchema.safeParse({
      bookId,revision,meetingId,
      status: "did_not_attend",
      rating: 3,
    }).success,
    false
  );
});

test("rejects invalid meeting IDs and out-of-range ratings", () => {
  assert.equal(
    ratingSubmissionSchema.safeParse({
      meetingId: "not-a-uuid",
      status: "read",
      rating: 5,
    }).success,
    false
  );
  assert.equal(
    ratingSubmissionSchema.safeParse({ bookId,revision,meetingId, status: "read", rating: 6 })
      .success,
    false
  );
});
