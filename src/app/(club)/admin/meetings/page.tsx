import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Monitor,
} from "lucide-react";
import { MeetingResultsForm } from "./meeting-manager";

export const metadata = {
  title: "Book Club Manager · Meetings admin",
};

export default async function AdminMeetingsPage() {
  const user = await getUser();
  if (!user || user.role !== "admin") redirect("/");

  const meetings=await(await getRepository()).adminMeetings();

  return (
    <div className="space-y-8">
      {/* Back nav */}
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Admin
        </Button>
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-5 h-5 text-amber" />
          <h1 className="font-heading text-3xl font-bold">Meetings</h1>
        </div>
        <p className="text-secondary mt-1">Notes from the table</p>
      </div>

      {/* Meeting list */}
      <div>
        <h2 className="font-heading text-xl font-semibold mb-4">
          All meetings ({meetings?.length || 0})
        </h2>

        {meetings && meetings.length > 0 ? (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    {/* Meeting info header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">
                            #{meeting.number}
                          </Badge>
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
                        <h3 className="font-heading text-lg font-semibold text-foreground truncate">
                          {meeting.book?.title || "TBD"}
                        </h3>
                        {meeting.book?.author && (
                          <p className="text-secondary text-sm">
                            by {meeting.book.author}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted">
                          {meeting.date && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(
                                meeting.date + "T00:00:00"
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                          {meeting.host?.display_name && (
                            <span>
                              Host:{" "}
                              <span className="text-secondary">
                                {meeting.host.display_name}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <Link href={`/meetings/${meeting.number}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>

                    {/* Expandable results form */}
                    <MeetingResultsForm
                      meetingId={meeting.id}
                      initialRevision={meeting.revision}
                      meetingNumber={meeting.number}
                      existingNotes={meeting.notes}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-secondary">No meetings yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
