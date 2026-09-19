import { getUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getBallotRepository } from "@/lib/ballots";
import { AdminDateMatrix } from "@/components/admin-date-matrix";
import { AdminBookBreakdown } from "@/components/admin-book-breakdown";
import {
  Shield,
  ArrowLeft,
  Users,
  Calendar,
  BookOpen,
  Home,
  GlassWater,
  Star,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {getRuntime} from '@/lib/runtime/context';

export const metadata = {
  title: "Book Club Manager · Survey admin",
};

export default async function SurveyAdminPage() {
  const user = await getUser();
  if (!user || user.role !== "admin") redirect("/");

  const view=await(await getBallotRepository()).admin();
  const {club}=await getRuntime();
  if(!view)return <p>No ballots yet. Prepare the first one with the cycle command.</p>;
  const {ballot,members,nonVoters,memberResponses,previousRatings:prevRatings,prevAvg}=view;
  const bookAverages=Object.fromEntries(view.bookAverages.map(b=>[b.id,b.averageRating]));
  const hosts=memberResponses.filter(r=>r.willingToHost),bourbonBringers=memberResponses.filter(r=>r.willingToBringBourbon);
  function memberName(member:{display_name:string;full_name:string}){return member.display_name||member.full_name;}

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
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber" />
          <h1 className="font-heading text-3xl font-bold">Survey admin</h1>
        </div>
        <p className="text-secondary mt-1">
          Who voted for what, #{ballot.meetingNumber}
        </p>
      </div>

      {/* Submission status */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-amber" />
            <h2 className="font-heading text-base font-semibold">
              Submissions: {memberResponses.length} of {members.length}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-success font-medium flex items-center gap-1 mb-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                Voted ({memberResponses.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {memberResponses.map((r) => (
                  <Badge key={r.memberId} variant="success">{r.memberName}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-error font-medium flex items-center gap-1 mb-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Haven&apos;t voted ({nonVoters.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {nonVoters.map((m) => (
                  <Badge key={m.id} variant="error">{memberName(m)}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Book ratings breakdown */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-amber" />
            <h2 className="font-heading text-lg font-semibold">Book ratings by member</h2>
          </div>
          {memberResponses.length > 0 ? (
            <AdminBookBreakdown
              books={ballot.books.map((b) => ({ id: b.id, title: b.title }))}
              responses={memberResponses}
              averages={bookAverages}
            />
          ) : (
            <p className="text-sm text-muted py-4 text-center">No votes in yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Date selection matrix */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-amber" />
            <h2 className="font-heading text-lg font-semibold">Date availability</h2>
          </div>
          <p className="text-xs text-muted mb-4">
            Click a column to see who can and can&apos;t make that date. Crown marks the best availability (yes counts 2, maybe counts 1). Ties get more than one crown.
          </p>
          {memberResponses.length > 0 ? (
            <AdminDateMatrix
              dateOptions={ballot.dateOptions}
              responses={memberResponses}
              nonVoters={nonVoters.map((m) => memberName(m))}
            />
          ) : (
            <p className="text-sm text-muted py-4 text-center">No votes in yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Meeting preferences */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-4 h-4 text-amber" />
              <h3 className="font-heading text-base font-semibold">Willing to host</h3>
            </div>
            {hosts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {hosts.map((r) => (
                  <Badge key={r.memberId} variant="success">{r.memberName}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No volunteers yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <GlassWater className="w-4 h-4 text-amber" />
              <h3 className="font-heading text-base font-semibold">Bringing {club.beverageLabel}</h3>
            </div>
            {bourbonBringers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {bourbonBringers.map((r) => (
                  <Badge key={r.memberId} variant="success">{r.memberName}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No volunteers yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Previous book ratings. Nothing to grade when there is no previous book. */}
      {ballot.previousBook && (
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber" />
            <h3 className="font-heading text-base font-semibold">
              Previous book: {ballot.previousBook.title}
            </h3>
            {prevAvg > 0 && (
              <Badge variant="default">
                Avg: {prevAvg.toFixed(1)}/5
              </Badge>
            )}
          </div>
          {prevRatings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {prevRatings
                .sort((a, b) => b.rating - a.rating)
                .map((r) => (
                  <div key={r.memberId} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border/50">
                    <span className="text-xs text-secondary">{r.name}</span>
                    <span className="font-mono text-sm font-semibold text-foreground">{r.rating}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No ratings yet.</p>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
