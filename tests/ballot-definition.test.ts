import assert from "node:assert/strict";
import test from "node:test";
import { ballotDefinitionSchema } from "../src/lib/ballots/definition";

const nominee = (over: Record<string, unknown> = {}) => ({
  slug: "book-a",
  title: "Book A",
  author: "Invented Author",
  recommendedBy: "Fictional Reader",
  description: "A description of the book.",
  caseFor: "It is short.",
  caseAgainst: "It is dull.",
  pages: 200,
  ...over,
});

test("accepts a well-formed ballot definition and applies defaults", () => {
  const parsed = ballotDefinitionSchema.parse({
    meetingNumber: 7,
    dates: ["2035-05-08", "2035-05-09"],
    nominees: [nominee(), nominee({ slug: "book-b", title: "Book B" })],
  });
  assert.equal(parsed.nominees[0].subtitle, null);
  assert.deepEqual(parsed.nominees[0].sources, []);
});

test("rejects duplicate slugs, duplicate dates, bad slugs, and bad dates", () => {
  const base = { meetingNumber: 7, dates: ["2035-05-08"] };
  assert.throws(() =>
    ballotDefinitionSchema.parse({ ...base, nominees: [nominee(), nominee()] })
  );
  assert.throws(() =>
    ballotDefinitionSchema.parse({
      meetingNumber: 7,
      dates: ["2035-05-08", "2035-05-08"],
      nominees: [nominee(), nominee({ slug: "book-b" })],
    })
  );
  assert.throws(() =>
    ballotDefinitionSchema.parse({ ...base, nominees: [nominee({ slug: "Book A" }), nominee({ slug: "b" })] })
  );
  assert.throws(() =>
    ballotDefinitionSchema.parse({ meetingNumber: 7, dates: ["may-08"], nominees: [nominee(), nominee({ slug: "b" })] })
  );
});

test("rejects a blurb that claims 'longest' when a longer book is on the ballot", () => {
  assert.throws(() =>
    ballotDefinitionSchema.parse({
      meetingNumber: 7,
      dates: ["2035-05-08"],
      nominees: [
        nominee({ pages: 448, caseAgainst: "At 448 pages it's the longest book on the ballot." }),
        nominee({ slug: "book-b", pages: 496 }),
      ],
    })
  );
});
