import assert from "node:assert/strict";
import test from "node:test";
import { dateOptionFromIso } from "../src/lib/ballots/dates";
import { ballotDefinitionSchema } from "../src/lib/ballots/definition";

const nominee = (slug: string) => ({ slug, title: slug, author: "Invented Author",
  recommendedBy: "Fictional Reader", description: "An invented book.",
  caseFor: "A small cast.", caseAgainst: "A slow beginning." });

test("impossible calendar dates are rejected before a ballot can be written", () => {
  for (const date of ["2035-02-29", "2036-02-30", "2035-04-31", "2035-00-14", "2035-13-01", "2035-01-00"]) {
    assert.throws(() => dateOptionFromIso(date), date);
    assert.equal(ballotDefinitionSchema.safeParse({ meetingNumber: 7, dates: [date],
      nominees: [nominee("paper-island"), nominee("clock-orchard")] }).success, false, date);
  }
});

test("valid leap days and year boundaries retain the requested date", () => {
  assert.equal(dateOptionFromIso("2036-02-29").label, "Friday, February 29th");
  assert.equal(dateOptionFromIso("2035-12-31").id, "2035-12-31");
});

test("a validated definition retains its explicit previous reading assignment", () => {
  const previousMeetingId = "10000000-0000-4000-8000-000000000001";
  const result = ballotDefinitionSchema.parse({meetingNumber: 7, previousMeetingId,
    dates: ["2036-02-29"], nominees: [nominee("paper-island"), nominee("clock-orchard")]});
  assert.equal(result.previousMeetingId, previousMeetingId);
});
