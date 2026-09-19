import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonalizedHighlight } from "@/components/ui/personalized-highlight";
import { VoteChart } from "@/components/vote-chart";
import { BookCover } from "@/components/book-cover";
import { BookRatingControl } from "@/components/book-rating-control";
import {getRuntime} from '@/lib/runtime/context';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Monitor,
  User,
  Lightbulb,
  Star,
  BarChart3,
  StickyNote,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const meetingNumber = parseInt(number, 10);
  if (isNaN(meetingNumber)) return { title: "Book Club Manager" };

  const meeting=(await(await getRepository()).meetingDetail(meetingNumber))?.meeting;

  if (!meeting) return { title: "Book Club Manager" };
  const bookTitle = (meeting.book as unknown as { title: string } | null)?.title;
  return {
    title: bookTitle
      ? `Book Club Manager · #${meeting.number} ${bookTitle}`
      : `Book Club Manager · #${meeting.number}`,
  };
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const user = await getUser();
  if (!user) return null;

  const { number } = await params;
  const meetingNumber = parseInt(number, 10);
  if (isNaN(meetingNumber)) notFound();

  const detail=await(await getRepository()).meetingDetail(meetingNumber);
  if(!detail)notFound();
  const {meeting,ballots,submitter,myBallotVote,verdicts,beverageVolunteers,beverages}=detail;
  const {club}=await getRuntime();
  const selectedTitle=meeting.book?.title??null;
  const isHost=meeting.host_id===user.memberId;
  const hasVoteData=ballots.length>0;
  const myVerdict=verdicts.find(v=>v.member_id===user.memberId)??null;
  const readVerdicts = verdicts.filter((v) => v.status === "read" && v.rating);
  const avgVerdict =
    readVerdicts.length > 0
      ? readVerdicts.reduce((a, v) => a + (v.rating || 0), 0) / readVerdicts.length
      : null;
  const didNotRead = verdicts.filter((v) => v.status === "did_not_read");
  const didNotAttend = verdicts.filter((v) => v.status === "did_not_attend");
  const skippedLine = [
    didNotRead.length > 0 ? `${didNotRead.length} skipped the book` : null,
    didNotAttend.length > 0
      ? `${didNotAttend.length} ${didNotAttend.length === 1 ? "wasn't" : "weren't"} there`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <Link href="/meetings">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          All meetings
        </Button>
      </Link>

      {/* Meeting header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="default" className="text-sm px-3 py-1">
            #{meeting.number}
          </Badge>
          {meeting.format && (
            <Badge
              variant={meeting.format === "Virtual" ? "warning" : "secondary"}
            >
              <span className="flex items-center gap-1">
                {meeting.format === "Virtual" ? (
                  <Monitor className="w-3 h-3" />
                ) : (
                  <MapPin className="w-3 h-3" />
                )}
                {meeting.format}
              </span>
            </Badge>
          )}
        </div>

        <div className="flex gap-6 items-start">
          {meeting.book?.title && (
            <BookCover coverUrl={meeting.book.cover_image_url} title={meeting.book.title} author={meeting.book.author} size="lg" />
          )}
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold">
              {meeting.book?.title || "TBD"}
            </h1>
            {meeting.book?.author && (
              <p className="text-secondary text-lg mt-1">
                by {meeting.book.author}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Meeting metadata */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {meeting.date && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-amber" />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                    Date
                  </p>
                  <p className="text-sm text-foreground font-medium">
                    {new Date(
                      meeting.date + "T00:00:00"
                    ).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}

            {meeting.host?.display_name && (
              <PersonalizedHighlight
                isYours={isHost}
                className="p-0 rounded-lg"
                showBadge={false}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-amber" />
                  </div>
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                      Host
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {meeting.host.display_name}
                    </p>
                  </div>
                </div>
              </PersonalizedHighlight>
            )}

            {meeting.location && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-amber" />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                    Location
                  </p>
                  <p className="text-sm text-foreground font-medium">
                    {meeting.location}
                  </p>
                </div>
              </div>
            )}

            {submitter && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4 text-amber" />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
                    Put forward by
                  </p>
                  <p className="text-sm text-foreground font-medium">{submitter}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(beverageVolunteers.length>0||beverages.length>0)&&<Card><CardHeader><CardTitle>{club.beverageLabel[0].toUpperCase()+club.beverageLabel.slice(1)}</CardTitle></CardHeader><CardContent className="space-y-3">
       {beverageVolunteers.length>0&&<p className="text-sm text-secondary">Volunteers: {beverageVolunteers.map(v=>v.name).join(', ')}</p>}
       {beverages.map(b=><div key={b.id}><p className="font-medium">{b.name??'A shared drink'}{b.broughtBy&&<span className="text-sm text-secondary"> · Brought by {b.broughtBy}</span>}</p>{b.notes&&<p className="text-sm text-secondary">{b.notes}</p>}</div>)}
      </CardContent></Card>}

      {/* Your verdict + the table's verdict (only for books we actually read) */}
      {selectedTitle && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-amber/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber" />
                Your verdict
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BookRatingControl
                meetingId={meeting.id}
                  bookId={meeting.book_id!}
                  initialRevision={myVerdict?.revision??0}
                initialRating={myVerdict?.rating ?? null}
                initialStatus={
                  (myVerdict?.status as "read" | "did_not_read" | "did_not_attend") ??
                  null
                }
              />
              {myBallotVote != null && (
                <p className="text-xs text-muted">
                  For the record, you gave it {myBallotVote}/5 back when it was on
                  the ballot.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber" />
                The table&apos;s verdict
              </CardTitle>
            </CardHeader>
            <CardContent>
              {avgVerdict != null ? (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-mono text-3xl font-bold text-amber">
                      {avgVerdict.toFixed(1)}
                    </span>
                    <span className="text-sm text-secondary">
                      / 5 · {readVerdicts.length}{" "}
                      {readVerdicts.length === 1 ? "rating" : "ratings"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {readVerdicts.map((v) => (
                      <div
                        key={v.member_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-secondary">
                          {v.member?.display_name || "Someone"}
                        </span>
                        <span className="font-mono text-foreground">
                          {v.rating}/5
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-secondary">
                  No verdicts in yet. Be the first to go on record.
                </p>
              )}
              {skippedLine && (
                <p className="text-xs text-muted mt-3">{skippedLine}.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notes */}
      {meeting.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-amber" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-secondary whitespace-pre-wrap leading-relaxed">
              {meeting.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Vote results */}
      {!hasVoteData && selectedTitle && (
        <p className="text-sm text-muted">No ballot on record for this one.</p>
      )}
      {hasVoteData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber" />
              Vote results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber inline-block" />
                  Selected book
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#3d3428] inline-block" />
                  Other nominees
                </span>
              </div>
            </div>
            <VoteChart
              data={ballots.map((b) => ({
                title: b.book_title,
                average_rating: b.average_rating || 0,
                was_selected: b.was_selected,
              }))}
            />
            {/* Detailed ballot table */}
            <div className="mt-6 border-t border-border pt-4">
              <div className="space-y-2">
                {ballots.map((ballot) => (
                  <div
                    key={ballot.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {ballot.was_selected && (
                        <Badge variant="default" className="shrink-0">
                          Winner
                        </Badge>
                      )}
                      <span className="text-sm text-foreground truncate">
                        {ballot.book_title}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      {ballot.num_voters && (
                        <span className="text-xs text-muted">
                          {ballot.num_voters} vote{ballot.num_voters !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="font-mono text-sm text-amber font-medium w-10 text-right">
                        {ballot.average_rating
                          ? ballot.average_rating.toFixed(1)
                          : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
