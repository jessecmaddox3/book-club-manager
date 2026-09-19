import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeksFromDates, dateOptionFromIso } from "../src/lib/ballots/dates";

test("dateOptionFromIso renders the long label the ballot uses", () => {
  assert.deepEqual(dateOptionFromIso("2026-09-14"), {
    id: "2026-09-14",
    label: "Monday, September 14th",
    week: dateOptionFromIso("2026-09-14").week,
  });
  assert.equal(dateOptionFromIso("2026-09-01").label, "Tuesday, September 1st");
  assert.equal(dateOptionFromIso("2026-09-22").label, "Tuesday, September 22nd");
  assert.equal(dateOptionFromIso("2026-09-03").label, "Thursday, September 3rd");
  assert.equal(dateOptionFromIso("2026-09-11").label, "Friday, September 11th");
});

test("dates in the same Monday-to-Sunday week share a week index", () => {
  const mon = dateOptionFromIso("2026-09-14").week;
  const sun = dateOptionFromIso("2026-09-20").week;
  const nextMon = dateOptionFromIso("2026-09-21").week;
  assert.equal(mon, sun);
  assert.equal(nextMon, mon + 1);
});

test("buildWeeksFromDates groups and labels like the static config did", () => {
  const options = [
    "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27",
    "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
    "2026-09-07", "2026-09-08",
  ].map(dateOptionFromIso);
  const weeks = buildWeeksFromDates(options);
  assert.deepEqual(
    weeks.map((w) => [w.week, w.label, w.dates.length]),
    [
      [1, "Aug 24 - 27", 4],
      [2, "Aug 31 - Sep 3", 4],
      [3, "Sep 7 - 8", 2],
    ]
  );
  assert.equal(weeks[1].dates[0].id, "2026-08-31");
});

test("dateOptionFromIso rejects anything that is not an ISO date", () => {
  assert.throws(() => dateOptionFromIso("sep-14"));
});
