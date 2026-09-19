import { getRepository } from "@/lib/store";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Hash, Plus, Sparkles, BookX } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Book Club Manager · Books",
};

export default async function BooksPage() {
  const books=await(await getRepository()).readBooks();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold">Books</h1>
        <p className="text-secondary mt-1">
          Every book the club has read
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 text-secondary">
          <BookOpen className="w-4 h-4" />
          <span className="text-sm">
            <span className="font-mono font-bold text-foreground">
              {books.length}
            </span>{" "}
            books read
          </span>
        </div>
        <div className="flex gap-2">
          <Link href="/books/submit">
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Put a book in the hat
            </Button>
          </Link>
          <Link href="/books/also-rans">
            <Button size="sm" variant="secondary">
              <BookX className="w-4 h-4" />
              Also-rans
            </Button>
          </Link>
          <Link href="/books/recommend">
            <Button size="sm" variant="secondary">
              <Sparkles className="w-4 h-4" />
              Find my next read
            </Button>
          </Link>
          <Link href="/books/rate">
            <Button size="sm" variant="secondary">
              <Star className="w-4 h-4" />
              Rate the backlog
            </Button>
          </Link>
        </div>
      </div>

      {/* Books grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map(({ book, numbers }) => {
          const meetingNumber = numbers[0];
          const title = book.title as string;
          const author = book.author as string;
          const goodreadsRating = book.goodreads_rating as number | null;
          const genre = book.genre as string | null;
          const pageCount = book.page_count as number | null;

          return (
            <Link
              key={book.id as string}
              href={`/meetings/${meetingNumber}`}
              className="group"
            >
              <Card className="h-full hover:border-border-light transition-colors">
                <CardContent>
                  <div className="flex items-start gap-3">
                    <BookCover coverUrl={book.cover_image_url} title={title} author={author} size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-base font-semibold text-foreground group-hover:text-amber transition-colors line-clamp-2">
                        {title}
                      </h3>
                      <p className="text-secondary text-sm mt-1 truncate">
                        {author}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-muted shrink-0">
                      <Hash className="w-3 h-3" />
                      <span className="font-mono text-xs">
                        {meetingNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {genre && (
                      <Badge variant="secondary">{genre}</Badge>
                    )}
                    {goodreadsRating && (
                      <div className="flex items-center gap-1 text-muted">
                        <Star className="w-3 h-3 fill-amber text-amber" />
                        <span className="font-mono text-xs">
                          {Number(goodreadsRating).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {numbers.length > 1 && (
                      <span className="text-xs text-muted">
                        {numbers.length} meetings
                      </span>
                    )}
                  </div>

                  {pageCount && (
                    <p className="text-xs text-muted mt-2">
                      {pageCount} pages
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {books.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-secondary">No books recorded yet.</p>
        </div>
      )}
    </div>
  );
}
