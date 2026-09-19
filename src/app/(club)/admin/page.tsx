import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Vote, Users, Calendar, ChevronRight } from "lucide-react";

export const metadata = {
  title: "Book Club Manager · Admin",
};

export default async function AdminPage() {
  const user = await getUser();
  if (!user || user.role !== "admin") redirect("/");

  const {memberCount,meetingCount,openBallot}=await(await getRepository()).adminSummary();
  const ballot={status:openBallot?'open':'none',meetingNumber:openBallot?.meetingNumber};

  const adminLinks = [
    {
      href: "/survey/admin",
      label: "The ballot",
      description: "Standings, who has voted, who still owes a ballot",
      icon: Vote,
      stat:
        ballot.status === "open"
          ? `#${ballot.meetingNumber} open`
          : "No ballot open",
    },
    {
      href: "/admin/members",
      label: "Members",
      description: "Who's in, who's out, who's admin",
      icon: Users,
      stat: `${memberCount || 0} active`,
    },
    {
      href: "/admin/meetings",
      label: "Meetings",
      description: "Notes from the table",
      icon: Calendar,
      stat: `${meetingCount || 0} total`,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-amber" />
          <h1 className="font-heading text-3xl font-bold">Admin</h1>
        </div>
        <p className="text-secondary mt-1">The part where the organizer does paperwork.</p>
      </div>

      {/* Quick links */}
      <div>
        <div className="space-y-3">
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block group">
              <Card className="hover:border-border-light transition-colors">
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center shrink-0">
                        <link.icon className="w-5 h-5 text-amber" />
                      </div>
                      <div>
                        <h3 className="font-heading text-base font-semibold group-hover:text-amber transition-colors">
                          {link.label}
                        </h3>
                        <p className="text-sm text-secondary">
                          {link.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="secondary">{link.stat}</Badge>
                      <ChevronRight className="w-5 h-5 text-muted group-hover:text-amber transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
