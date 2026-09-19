import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Vote, Pencil, Star, ChevronRight, CalendarClock } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import {getRuntime} from "@/lib/runtime/context";

export default async function Home() {
  const user = await getUser();
  if (!user) return null;

  const {openBallot,hasVoted,latest,upcoming,unrated,meetings}=await(await getRepository()).home();
  const ballot={status:openBallot?'open':'none',meetingNumber:openBallot?.meetingNumber};
  const {club}=await getRuntime();

  return (
    <div className="space-y-8">
      {/* Masthead */}
      <div>
        <h1 className="font-heading text-3xl font-bold">{club.name}</h1>
        <p className="text-secondary mt-1">
          {club.tagline}
        </p>
      </div>

      {/* Next meeting — always present */}
      <Card className="border-amber/20">
        <CardContent>
          <div className="flex items-center gap-2 text-secondary mb-3">
            <CalendarClock className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide">Next meeting</span>
          </div>
          {ballot.status === "open" ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-xl font-semibold">
                  #{ballot.meetingNumber} · still TBD
                </h3>
                <p className="text-secondary text-sm mt-1">
                  Book and date are being fought over on the ballot right now.
                </p>
              </div>
              <Link
                href="/survey"
                className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber hover:bg-amber/15 transition-colors"
              >
                {hasVoted ? <Pencil className="w-4 h-4" /> : <Vote className="w-4 h-4" />}
                {hasVoted ? "Your vote is in · edit" : "Cast your ballot"}
              </Link>
            </div>
          ) : upcoming ? (
            <div className="flex items-start gap-4">
              {upcoming.book?.title && (
                <BookCover coverUrl={upcoming.book.cover_image_url} title={upcoming.book.title} author={upcoming.book.author} size="md" />
              )}
              <div>
                <h3 className="font-heading text-xl font-semibold">
                  {upcoming.book?.title || "TBD"}
                </h3>
                <p className="text-secondary text-sm mt-1">{upcoming.book?.author}</p>
                {upcoming.date && (
                  <p className="text-muted text-sm mt-2">
                    {new Date(upcoming.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="font-heading text-xl font-semibold">Between books</h3>
              <p className="text-secondary text-sm mt-1">
                {latest?.book?.title
                  ? `#${latest.number} was ${latest.book.title}. Recs for the next one are open, nominate a book from the Books page.`
                  : "Recs for the next one are open, nominate a book from the Books page."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gentle nagging about unrated books */}
      {unrated.length > 0 && (
        <Link href="/books/rate">
          <Card className="hover:border-border-light transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-amber" />
                </div>
                <div>
                  <p className="font-medium">
                    {unrated.length} {unrated.length === 1 ? "book is" : "books are"} still waiting on your verdict.
                  </p>
                  <p className="text-sm text-secondary">
                    Rate them right here. Stars are live, wave off the ones you skipped.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* The back catalog */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-semibold">The back catalog</h2>
          <Link
            href="/meetings"
            className="text-sm text-amber hover:text-amber-light transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {meetings.slice(0, 5).map((m) => (
            <Link
              key={m.number}
              href={`/meetings/${m.number}`}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:border-border-light hover:bg-card transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-muted w-8">#{m.number}</span>
                {m.book?.title && <BookCover coverUrl={m.book.cover_image_url} title={m.book.title} size="sm" />}
                <div>
                  <p className="text-sm font-medium group-hover:text-amber transition-colors">
                    {m.book?.title || "TBD"}
                  </p>
                  <p className="text-xs text-muted">{m.book?.author}</p>
                </div>
              </div>
              {m.date && (
                <span className="text-xs text-muted">
                  {new Date(m.date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
