import { getRepository } from "@/lib/store";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Hash, ChevronLeft, Trophy } from "lucide-react";
import { BookCover } from "@/components/book-cover";

export const metadata = {
  title: "Book Club Manager · Also-rans",
};

export default async function AlsoRansPage() {
  const alsoRans=await(await getRepository()).alsoRans();

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        All books
      </Link>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold">Also-rans</h1>
        <p className="text-secondary mt-1">
          Nominated, not chosen (at least not that time). The ones that got away.
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-secondary">
        <BookOpen className="w-4 h-4" />
        <span className="text-sm">
          <span className="font-mono font-bold text-foreground">
            {alsoRans.length}
          </span>{" "}
          books that lost a ballot
        </span>
      </div>

      {/* Books list */}
      <div className="space-y-3">
        {alsoRans.map((book) => (
          <Card key={book.bookId}>
            <CardContent>
              <div className="flex items-start gap-3">
                <BookCover
                  title={book.title}
                  coverUrl={book.coverUrl}
                  author={book.author || undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-base font-semibold text-foreground">
                    {book.title}
                  </h3>
                  {book.author && book.author !== "Unknown" && (
                    <p className="text-secondary text-sm">{book.author}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {book.bestAvgRating !== null && (
                      <div className="flex items-center gap-1 text-muted">
                        <Star className="w-3.5 h-3.5 fill-amber text-amber" />
                        <span className="font-mono text-xs">
                          {Number(book.bestAvgRating).toFixed(1)}
                        </span>
                        <span className="text-xs">avg</span>
                      </div>
                    )}
                    {book.bestGoodreadsRating !== null && (
                      <div className="flex items-center gap-1 text-muted">
                        <Star className="w-3.5 h-3.5" />
                        <span className="font-mono text-xs">
                          {Number(book.bestGoodreadsRating).toFixed(2)}
                        </span>
                        <span className="text-xs">GR</span>
                      </div>
                    )}
                    {book.timesNominated > 1 && (
                      <div className="flex items-center gap-1 text-muted">
                        <Hash className="w-3.5 h-3.5" />
                        <span className="text-xs">
                          {book.timesNominated}x nominated
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {book.hadRunoff && (
                      <Badge variant="warning">Runoff</Badge>
                    )}
                    {book.laterSelected && (
                      <Badge variant="success">
                        <Trophy className="w-3 h-3 mr-1" />
                        Later selected #{book.laterSelected}
                      </Badge>
                    )}
                    {book.meetingNumbers
                      .sort((a, b) => a - b)
                      .map((num) => (
                        <Link
                          key={num}
                          href={`/meetings/${num}`}
                          className="hover:opacity-80 transition-opacity"
                        >
                          <Badge variant="secondary">
                            <Hash className="w-2.5 h-2.5 mr-0.5" />
                            {num}
                          </Badge>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {alsoRans.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-secondary">Nothing has lost a ballot yet.</p>
        </div>
      )}
    </div>
  );
}
