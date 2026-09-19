import { getUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { SurveyForm } from "@/components/survey-form";
import { getActiveBallot } from "@/lib/ballots";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Book Club Manager · Ballot",
};

export default async function SurveyPage() {
  const user = await getUser();
  if (!user) return null;

  const ballot = await getActiveBallot();

  if(!ballot)return <p>No ballot is open yet. Your organizer can prepare one with the cycle command.</p>;

  // Voting email links should lead to the finalized meeting after close.
  if (ballot.status === "closed") {
    redirect(`/meetings/${ballot.meetingNumber}`);
  }

  const existingResponse=ballot.existingResponse;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Ballot #{ballot.meetingNumber}</h1>
          <p className="text-secondary mt-1 text-base">
            Rate every nominee, then tell us which nights work. Dates are optional.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={existingResponse ? "success" : "warning"}>
            {existingResponse ? "Your vote is in" : "You owe us a ballot"}
          </Badge>
          <Link
            href="/survey/results"
            className="flex items-center gap-2 text-sm text-amber hover:text-amber/80 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Results
          </Link>
        </div>
      </div>

      <SurveyForm
        surveyId={ballot.surveyId}
        books={ballot.books}
        dateOptions={ballot.dateOptions}
        weeks={ballot.weeks}
        previousBook={ballot.previousBook}
        existingResponse={existingResponse}
        ballotId={ballot.id}
        ballotRevision={ballot.revision}
        key={ballot.id+':'+ballot.revision}
      />
    </div>
  );
}
