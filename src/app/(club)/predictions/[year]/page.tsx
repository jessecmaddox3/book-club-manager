import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonalizedHighlight } from "@/components/ui/personalized-highlight";
import {
  ArrowLeft,
  Sparkles,
  Target,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

function ResultBadge({ result }: { result: "Yes" | "No" | "Partial" | null }) {
  if (result === "Yes") {
    return <Badge variant="success">Yes</Badge>;
  }
  if (result === "No") {
    return <Badge variant="error">No</Badge>;
  }
  if (result === "Partial") {
    return <Badge variant="warning">Partial</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const parsed = parseInt(year, 10);
  return {
    title: isNaN(parsed)
      ? "Book Club Manager"
      : `Book Club Manager · ${parsed} predictions`,
  };
}

export default async function PredictionsYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const user = await getUser();
  if (!user) return null;

  const { year: yearParam } = await params;
  const year = parseInt(yearParam, 10);
  if (isNaN(year)) notFound();

  const {predictions,goals}=await(await getRepository()).annual(year);

  // If no data at all for this year, 404
  if (
    (!predictions || predictions.length === 0) &&
    (!goals || goals.length === 0)
  ) {
    notFound();
  }

  // Summary stats for predictions
  const totalPredictions = predictions?.length || 0;
  const scoredCount = (predictions || []).filter(
    (p) => p.result !== null
  ).length;
  const correctCount = (predictions || []).filter(
    (p) => p.result === "Yes"
  ).length;
  const accuracy =
    scoredCount > 0 ? Math.round((correctCount / scoredCount) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <Link href="/predictions">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          All predictions
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            {year}
          </h1>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-amber" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                  Predictions
                </p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {totalPredictions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-amber" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                  Scored
                </p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {scoredCount}
                  <span className="text-muted text-sm font-normal">
                    /{totalPredictions}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-amber" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                  Accuracy
                </p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {scoredCount > 0 ? `${accuracy}%` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-amber" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                  Goals
                </p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {goals?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bold predictions */}
      {predictions && predictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber" />
              Bold predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {predictions.map((p) => {
                const isCurrentUser = p.member_id === user.memberId;

                return (
                  <PersonalizedHighlight
                    key={p.id}
                    isYours={isCurrentUser}
                    className="rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {p.prediction}
                        </p>
                        <p className="text-xs text-muted mt-1">
                          {p.member?.display_name || "Unknown"}
                        </p>
                        {p.result_notes && (
                          <p className="text-xs text-secondary mt-1.5 italic">
                            {p.result_notes}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <ResultBadge result={p.result} />
                      </div>
                    </div>
                  </PersonalizedHighlight>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal goals */}
      {goals && goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber" />
              Personal goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {goals.map((g) => {
                const isCurrentUser = g.member_id === user.memberId;

                return (
                  <PersonalizedHighlight
                    key={g.id}
                    isYours={isCurrentUser}
                    className="rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {g.goal}
                        </p>
                        <p className="text-xs text-muted mt-1">
                          {g.member?.display_name || "Unknown"}
                        </p>
                        {g.result_notes && (
                          <p className="text-xs text-secondary mt-1.5 italic">
                            {g.result_notes}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <ResultBadge result={g.result} />
                      </div>
                    </div>
                  </PersonalizedHighlight>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
