import assert from "node:assert/strict";
import test from "node:test";
import {nominationSubmissionSchema} from "../src/lib/nominations";

test("validates and normalizes a nomination submission", () => {
  const parsed = nominationSubmissionSchema.parse({
    title: "  A Book  ",
    author: "  An Author ",
    description: "  A useful description.  ",
    pageCount: 240,
    audiobookLength: null,
    goodreadsRating: 4.2,
  });

  assert.equal(parsed.title, "A Book");
  assert.equal(parsed.author, "An Author");
  assert.equal(parsed.description, "A useful description.");
});
