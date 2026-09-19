import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Lightbulb,
  ChevronLeft,
  Hash,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  Clock,
  Home,
  BookMarked,
} from "lucide-react";

function ResultIcon({ result }: { result: string | null }) {
  switch (result) {
    case "Yes":
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case "No":
      return <XCircle className="w-4 h-4 text-error" />;
    case "Partial":
      return <MinusCircle className="w-4 h-4 text-warning" />;
    default:
      return <HelpCircle className="w-4 h-4 text-muted" />;
  }
}

function resultBadgeVariant(result: string | null) {
  switch (result) {
    case "Yes":
      return "success" as const;
    case "No":
      return "error" as const;
    case "Partial":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member=(await(await getRepository()).memberProfile(id))?.member;

  const name = member?.full_name || member?.display_name;
  return {
    title: name ? `Book Club Manager · ${name}` : "Book Club Manager",
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return null;

  const profile=await(await getRepository()).memberProfile(id);
  if(!profile)notFound();
  const {member,predictions,goals,hostedCount,nominations:enrichedNominations}=profile;
  const nominations=enrichedNominations;
  const isCurrentUser=member.id===user.memberId;
  const tenure=member.joined_info;

  function roleLabel(role: string) {
    switch (role) {
      case "admin":
        return "Admin";
      case "former":
        return "Alumnus";
      default:
        return "Member";
    }
  }

  function roleBadgeVariant(role: string) {
    switch (role) {
      case "admin":
        return "default" as const;
      case "former":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  }

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        All members
      </Link>

      {/* Profile header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-heading text-3xl font-bold">
            {member.full_name}
          </h1>
          <Badge variant={roleBadgeVariant(member.role)}>
            {roleLabel(member.role)}
          </Badge>
          {isCurrentUser && <Badge variant="you">You</Badge>}
        </div>
        {member.joined_info && (
          <p className="text-secondary">{member.joined_info}</p>
        )}
        {member.notes && (
          <p className="text-muted text-sm mt-2">{member.notes}</p>
        )}
      </div>

      {/* Society dossier (mock-serious biography) */}
      {member.bio && (
        <Card className="border-amber/20">
          <CardContent>
            <div className="flex items-center gap-2 text-secondary mb-3">
              <BookMarked className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">
                From the club records
              </span>
            </div>
            <p className="text-secondary leading-relaxed">{member.bio}</p>
            <p className="text-[11px] text-muted mt-3 italic">
              Official biography. Some details may be true.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats grid - 2x3 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-secondary mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Tenure</span>
            </div>
            <p className="font-mono text-2xl font-bold text-foreground">
              {tenure || "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-secondary mb-2">
              <Home className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Hosted</span>
            </div>
            <p className="font-mono text-2xl font-bold text-foreground">
              {hostedCount || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-secondary mb-2">
              <BookMarked className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">
                Nominations
              </span>
            </div>
            <p className="font-mono text-2xl font-bold text-foreground">
              {nominations?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-secondary mb-2">
              <Target className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">
                Predictions
              </span>
            </div>
            <p className="font-mono text-2xl font-bold text-foreground">
              {predictions?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Nominations */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookMarked className="w-4 h-4 text-amber" />
          <h2 className="font-heading text-xl font-semibold">
            Nominations
          </h2>
        </div>
        {enrichedNominations.length === 0 ? (
          <p className="text-muted text-sm">
            Hasn&apos;t put a book forward yet.
          </p>
        ) : (
          <div className="space-y-2">
            {enrichedNominations.map((nom) => (
              <Link
                key={nom.id}
                href={`/meetings/${nom.meeting_number}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:border-border-light hover:bg-card transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted w-8 flex items-center gap-0.5">
                    <Hash className="w-3 h-3" />
                    {nom.meeting_number}
                  </span>
                  <div>
                    <p className="text-sm font-medium group-hover:text-amber transition-colors">
                      {nom.book_title}
                    </p>
                    {nom.book_author && (
                      <p className="text-xs text-muted">{nom.book_author}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {nom.notes && (
                    <span className="text-xs text-muted max-w-[200px] truncate hidden sm:inline">
                      {nom.notes}
                    </span>
                  )}
                  {nom.outcome && (
                    <Badge
                      variant={
                        nom.outcome === "Selected" ? "success" : "secondary"
                      }
                    >
                      {nom.outcome}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Predictions */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-amber" />
          <h2 className="font-heading text-xl font-semibold">Predictions</h2>
        </div>
        {!predictions || predictions.length === 0 ? (
          <p className="text-muted text-sm">No predictions on the books.</p>
        ) : (
          <div className="space-y-3">
            {predictions.map((prediction) => (
              <Card key={prediction.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted">
                          {prediction.year}
                        </span>
                        <Badge variant={resultBadgeVariant(prediction.result)}>
                          {prediction.result || "Pending"}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">
                        {prediction.prediction}
                      </p>
                      {prediction.result_notes && (
                        <p className="text-xs text-muted mt-1">
                          {prediction.result_notes}
                        </p>
                      )}
                    </div>
                    <ResultIcon result={prediction.result} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Goals */}
      {goals && goals.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-amber" />
            <h2 className="font-heading text-xl font-semibold">Goals</h2>
          </div>
          <div className="space-y-3">
            {goals.map((goal) => (
              <Card key={goal.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted">
                          {goal.year}
                        </span>
                        <Badge variant={resultBadgeVariant(goal.result)}>
                          {goal.result || "Pending"}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{goal.goal}</p>
                      {goal.result_notes && (
                        <p className="text-xs text-muted mt-1">
                          {goal.result_notes}
                        </p>
                      )}
                    </div>
                    <ResultIcon result={goal.result} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
