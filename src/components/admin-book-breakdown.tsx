"use client";

import { cn } from "@/lib/cn";
import { Star } from "lucide-react";

interface BookInfo {
  id: string;
  title: string;
}

interface MemberRating {
  memberId: string;
  memberName: string;
  ratings: Record<string, number>;
}

interface AdminBookBreakdownProps {
  books: BookInfo[];
  responses: MemberRating[];
  averages: Record<string, number>;
}

export function AdminBookBreakdown({
  books,
  responses,
  averages,
}: AdminBookBreakdownProps) {
  const sortedBooks = [...books].sort(
    (a, b) => (averages[b.id] ?? 0) - (averages[a.id] ?? 0)
  );
  const topBookId = sortedBooks[0]?.id;

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-muted font-medium p-2 sticky left-0 bg-card z-10 min-w-[100px]">
              Member
            </th>
            {sortedBooks.map((book) => (
              <th
                key={book.id}
                className={cn(
                  "p-2 text-center min-w-[80px]",
                  book.id === topBookId && "bg-amber/5"
                )}
              >
                <span
                  className={cn(
                    "font-medium",
                    book.id === topBookId ? "text-amber" : "text-secondary"
                  )}
                >
                  {book.title.length > 18
                    ? book.title.slice(0, 16) + "..."
                    : book.title}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {responses.map((r) => (
            <tr key={r.memberId} className="border-t border-border/50">
              <td className="p-2 text-secondary font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
                {r.memberName}
              </td>
              {sortedBooks.map((book) => {
                const rating = r.ratings[book.id];
                return (
                  <td
                    key={book.id}
                    className={cn(
                      "p-2 text-center",
                      book.id === topBookId && "bg-amber/5"
                    )}
                  >
                    {rating ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="font-mono text-foreground">{rating}</span>
                        <Star className="w-3 h-3 text-amber fill-amber" />
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Averages row */}
          <tr className="border-t-2 border-border">
            <td className="p-2 text-amber font-semibold sticky left-0 bg-card z-10">
              Average
            </td>
            {sortedBooks.map((book) => (
              <td
                key={book.id}
                className={cn(
                  "p-2 text-center",
                  book.id === topBookId && "bg-amber/5"
                )}
              >
                <span className="font-mono font-semibold text-amber">
                  {(averages[book.id] ?? 0).toFixed(2)}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
