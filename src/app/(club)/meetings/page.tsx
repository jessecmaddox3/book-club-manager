import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonalizedHighlight } from "@/components/ui/personalized-highlight";
import {
  BookOpen,
  Calendar,
  MapPin,
  Monitor,
  Target,
  ChevronRight,
} from "lucide-react";
import { BookCover } from "@/components/book-cover";

export const metadata = {
  title: "Book Club Manager · History",
};

export default async function MeetingsPage() {
  const user = await getUser();
  if (!user) return null;

  const meetings=await(await getRepository()).meetings();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">History</h1>
          <p className="text-secondary mt-1">
            {meetings?.length || 0} meetings and counting
          </p>
        </div>
        <Link
          href="/predictions"
          className="flex items-center gap-2 text-sm text-amber hover:text-amber-light transition-colors"
        >
          <Target className="w-4 h-4" />
          Predictions
        </Link>
      </div>

      {/* Meeting list */}
      <div className="space-y-3">
        {meetings?.map((meeting) => {
          const isHost = meeting.host_id === user.memberId;

          const meetingCard = (
            <Link
              key={meeting.number}
              href={`/meetings/${meeting.number}`}
              className="block group"
            >
              <Card className="hover:border-border-light transition-colors">
                <CardContent>
                  <div className="flex items-start gap-4">
                    {meeting.book?.title && (
                      <BookCover coverUrl={meeting.book.cover_image_url} title={meeting.book.title} author={meeting.book.author} size="sm" className="mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">#{meeting.number}</Badge>
                        {meeting.format && (
                          <Badge
                            variant={
                              meeting.format === "Virtual"
                                ? "warning"
                                : "default"
                            }
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

                      <h3 className="font-heading text-lg font-semibold group-hover:text-amber transition-colors truncate">
                        {meeting.book?.title || "TBD"}
                      </h3>

                      {meeting.book?.author && (
                        <p className="text-secondary text-sm mt-0.5">
                          by {meeting.book.author}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-sm text-muted">
                        {meeting.date && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(
                              meeting.date + "T00:00:00"
                            ).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {meeting.host?.display_name && (
                          <span className="text-secondary">
                            Hosted by{" "}
                            <span className="text-foreground">
                              {meeting.host.display_name}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted group-hover:text-amber transition-colors mt-1 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );

          return (
            <PersonalizedHighlight
              key={meeting.number}
              isYours={isHost}
              showBadge={false}
            >
              {meetingCard}
            </PersonalizedHighlight>
          );
        })}

        {(!meetings || meetings.length === 0) && (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-secondary">No meetings yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
