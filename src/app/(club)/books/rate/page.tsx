import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { BookRatingControl } from "@/components/book-rating-control";

type MeetingRow=import("@/lib/store/reads").BacklogRow;

export const metadata = {
  title: "Book Club Manager · Rate the backlog",
};

export default async function RateBacklogPage() {
  const user = await getUser();
  if (!user) return null;

  const meetings=await(await getRepository()).backlog();
  const unrated=meetings.filter(m=>!m.answered),rated=meetings.filter(m=>m.answered);

  function Row({ m }: { m: MeetingRow }) {
    const mine = m.verdict;
    return (
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {m.book?.title && <BookCover coverUrl={m.book.cover_image_url} title={m.book.title} size="sm" />}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{m.book?.title}</p>
              <p className="text-xs text-muted truncate">
                #{m.number}
                {m.book?.author ? ` · ${m.book.author}` : ""}
              </p>
            </div>
          </div>
          <div className="sm:shrink-0">
            <BookRatingControl
              meetingId={m.id}
              bookId={m.book_id!}
              initialRevision={mine.revision}
              initialRating={mine?.rating ?? null}
              initialStatus={mine?.status ?? null}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/books">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Books
        </Button>
      </Link>

      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber" />
        <div>
          <h1 className="font-heading text-3xl font-bold">Rate the backlog</h1>
          <p className="text-secondary mt-1">
            Hover, click, move on. Wave off the ones you skipped.
          </p>
        </div>
      </div>

      {unrated.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-muted">
            Still owed ({unrated.length})
          </h2>
          {unrated.map((m) => (
            <Row key={m.id} m={m} />
          ))}
        </div>
      )}

      {rated.length > 0 && (
        <div className="space-y-3">
          {unrated.length === 0 && (
            <p className="text-secondary">You&apos;re square with the table.</p>
          )}
          <h2 className="text-xs uppercase tracking-wide text-muted">
            On the record ({rated.length})
          </h2>
          {rated.map((m) => (
            <Row key={m.id} m={m} />
          ))}
        </div>
      )}

      {meetings.length === 0 && (
        <p className="text-secondary">No books to rate yet.</p>
      )}
    </div>
  );
}
