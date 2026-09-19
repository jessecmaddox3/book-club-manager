// Date options for a database ballot are plain ISO dates. Everything the UI
// needs (the long label, the week grouping, the short week range label) is
// derived here instead of stored, which is what makes ballot_dates a single
// column.

export type DateOptionView = { id: string; label: string; week: number };
export type Week = { week: number; label: string; dates: DateOptionView[] };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function isCalendarDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number(iso.slice(0, 4)) < 1) return false;
  const date = new Date(iso + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

function parseIso(iso: string): Date {
  if (!isCalendarDate(iso)) throw new Error(`Expected a real calendar date (YYYY-MM-DD), got "${iso}"`);
  return new Date(iso + "T00:00:00.000Z");
}

// Monday-based week index since the Unix epoch, so two dates share a week
// number exactly when they fall Monday through Sunday of the same week.
function weekIndex(d: Date): number {
  const dayMs = 86_400_000;
  const days = Math.floor(d.getTime() / dayMs);
  // 1970-01-01 was a Thursday; shift so weeks start on Monday.
  return Math.floor((days + 3) / 7);
}

export function dateOptionFromIso(iso: string): DateOptionView {
  const d = parseIso(iso);
  return {
    id: iso,
    label: `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${ordinal(d.getUTCDate())}`,
    week: weekIndex(d),
  };
}

// Group options by week in first-seen order and label each group with its
// first and last date: "Sep 14 - 17", or "Aug 31 - Sep 3" across a month.
export function buildWeeksFromDates(options: DateOptionView[]): Week[] {
  const order: number[] = [];
  const groups = new Map<number, DateOptionView[]>();
  for (const option of options) {
    if (!groups.has(option.week)) {
      groups.set(option.week, []);
      order.push(option.week);
    }
    groups.get(option.week)!.push(option);
  }
  return order.map((week, i) => {
    const dates = groups.get(week)!;
    const first = parseIso(dates[0].id);
    const last = parseIso(dates[dates.length - 1].id);
    const fm = MONTHS[first.getUTCMonth()].slice(0, 3);
    const lm = MONTHS[last.getUTCMonth()].slice(0, 3);
    const label =
      fm === lm
        ? `${fm} ${first.getUTCDate()} - ${last.getUTCDate()}`
        : `${fm} ${first.getUTCDate()} - ${lm} ${last.getUTCDate()}`;
    // Renumber 1..n for display; the raw week index only matters for grouping.
    return { week: i + 1, label, dates: dates.map((d) => ({ ...d, week: i + 1 })) };
  });
}
