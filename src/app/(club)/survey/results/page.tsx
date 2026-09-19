import { getUser } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { getBallotRepository } from "@/lib/ballots";
import { BookAveragesChart, DateAvailabilityChart } from "@/components/survey-results-chart";
import { BarChart3, BookOpen, Calendar, ArrowLeft, Users, Star } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Book Club Manager · Vote results" };

export default async function SurveyResultsPage() {
  const user = await getUser();
  if (!user) return null;

  const result=await(await getBallotRepository()).results();
  if(result.kind==='none')return <p>No ballot results yet.</p>;
  if (result.kind==='vote_required') {
    return (
      <Card>
        <CardContent>
          <h1 className="font-heading text-2xl font-semibold">Vote first</h1>
          <p className="text-secondary mt-2">
            Standings show up once your ballot is in.
          </p>
          <Link
            href="/survey"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-amber hover:text-amber/80 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to the ballot
          </Link>
        </CardContent>
      </Card>
    );
  }

  const {ballot,totalVotes,bookAverages,dateAvailability,prevAvg}=result;
  const leaders=bookAverages.filter(b=>b.isLeader);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/survey"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to the ballot
        </Link>
        <h1 className="font-heading text-3xl font-bold">Vote results</h1>
        <p className="text-secondary mt-1">
          Meeting #{ballot.meetingNumber} · averages only
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted" />
              <p className="text-xs text-muted uppercase tracking-wide">Votes in</p>
            </div>
            <p className="font-mono text-2xl font-bold text-foreground">{totalVotes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-amber" />
              <p className="text-xs text-muted uppercase tracking-wide">
                {leaders.length > 1 ? "Tied at the top" : "Leading book"}
              </p>
            </div>
            <p className="font-heading text-sm font-semibold text-foreground">
              {leaders.length === 0
                ? "No votes in yet"
                : leaders.map((b) => b.title).join(" and ")}
            </p>
            {leaders.length > 0 && (
              <p className="font-mono text-lg font-bold text-amber">
                {leaders[0].averageRating.toFixed(2)}
                <span className="text-xs text-muted font-normal ml-1">avg of 1 to 5</span>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-muted" />
              <p className="text-xs text-muted uppercase tracking-wide">Last book, graded</p>
            </div>
            <p className="font-mono text-2xl font-bold text-foreground">
              {prevAvg > 0 ? prevAvg.toFixed(1) : "none yet"}
              {prevAvg > 0 && <span className="text-sm text-muted font-normal">/5</span>}
            </p>
            {ballot.previousBook && (
              <p className="text-xs text-secondary">{ballot.previousBook.title}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Book averages chart */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-amber" />
            <h2 className="font-heading text-lg font-semibold">Book ratings</h2>
          </div>
          {totalVotes > 0 ? (
            <BookAveragesChart data={bookAverages} />
          ) : (
            <p className="text-sm text-muted py-8 text-center">No votes in yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Date availability */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-amber" />
            <h2 className="font-heading text-lg font-semibold">Date availability</h2>
          </div>
          {totalVotes > 0 ? (
            <>
              {ballot.weeks.map((week) => {
                const weekDates = dateAvailability.filter((d) => d.week === week.week);
                return (
                  <div key={week.week} className="mb-4 last:mb-0">
                    <p className="text-xs text-muted uppercase tracking-wide mb-2">Week of {week.label}</p>
                    <DateAvailabilityChart data={weekDates} />
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-sm text-muted py-8 text-center">No votes in yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
