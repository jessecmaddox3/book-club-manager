import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Target,
  ChevronRight,
  TrendingUp,
  Calendar,
} from "lucide-react";

export const metadata = {
  title: "Book Club Manager · Predictions",
};

export default async function PredictionsPage() {
  const user = await getUser();
  if (!user) return null;

  const {predictions,goals}=await(await getRepository()).annual();

  // Build year-level counts
  const yearMap = new Map<
    number,
    { predictions: number; goals: number; scored: number; correct: number }
  >();

  for (const p of predictions || []) {
    const entry = yearMap.get(p.year) || {
      predictions: 0,
      goals: 0,
      scored: 0,
      correct: 0,
    };
    entry.predictions++;
    if (p.result !== null) {
      entry.scored++;
      if (p.result === "Yes") entry.correct++;
    }
    yearMap.set(p.year, entry);
  }

  for (const g of goals || []) {
    const entry = yearMap.get(g.year) || {
      predictions: 0,
      goals: 0,
      scored: 0,
      correct: 0,
    };
    entry.goals++;
    yearMap.set(g.year, entry);
  }

  const years = Array.from(yearMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, counts]) => ({ year, ...counts }));

  // Overall stats
  const totalPredictions = predictions?.length || 0;
  const totalScored = (predictions || []).filter(
    (p) => p.result !== null
  ).length;
  const totalCorrect = (predictions || []).filter(
    (p) => p.result === "Yes"
  ).length;
  const accuracyRate =
    totalScored > 0 ? Math.round((totalCorrect / totalScored) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold">Predictions</h1>
        <p className="text-secondary mt-1">
          Annual receipts. Confidence was high. Accuracy varied.
        </p>
      </div>

      {/* Overall stats */}
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
                  {accuracyRate}%
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Partials count as misses.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-amber" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                  Years
                </p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {years.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Year cards */}
      <div className="space-y-3">
        {years.map((y) => {
          const yearAccuracy =
            y.scored > 0 ? Math.round((y.correct / y.scored) * 100) : null;

          return (
            <Link
              key={y.year}
              href={`/predictions/${y.year}`}
              className="block group"
            >
              <Card className="hover:border-border-light transition-colors">
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-xl font-semibold group-hover:text-amber transition-colors">
                        {y.year}
                      </h3>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <Badge variant="secondary">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {y.predictions} prediction
                            {y.predictions !== 1 ? "s" : ""}
                          </span>
                        </Badge>
                        <Badge variant="secondary">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {y.goals} goal{y.goals !== 1 ? "s" : ""}
                          </span>
                        </Badge>
                        {yearAccuracy !== null && (
                          <span className="text-sm text-secondary">
                            <span className="font-mono font-medium text-foreground">
                              {yearAccuracy}%
                            </span>{" "}
                            accuracy
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted group-hover:text-amber transition-colors shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {years.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Sparkles className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-secondary">No predictions yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
