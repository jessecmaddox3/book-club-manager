import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonalizedHighlight } from "@/components/ui/personalized-highlight";
import {
  Users,
  Shield,
  Home,
  BookMarked,
  GraduationCap,
} from "lucide-react";

export const metadata = {
  title: "Book Club Manager · Members",
};

function parseEra(joinedInfo:string|null,leftInfo:string|null):string|null{
 return [joinedInfo,leftInfo].filter(Boolean).join(' · ')||null;
}

export default async function MembersPage() {
  const user = await getUser();
  if (!user) return null;

  const members=await(await getRepository()).memberDirectory();
  const hostedMap=new Map(members.map(m=>[m.id,m.hosted_count]));
  const nominationMap=new Map(members.map(m=>[m.id,m.nomination_count]));

  const currentMembers = members?.filter((m) => m.role !== "former") || [];
  const formerMembers = members?.filter((m) => m.role === "former") || [];

  function roleBadgeVariant(role: string) {
    switch (role) {
      case "admin":
        return "default" as const;
      case "former":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  }

  function roleLabel(role: string) {
    switch (role) {
      case "admin":
        return "Admin";
      case "former":
        return "Alumnus";
      default:
        return "Member";
    }
  }

  function MemberCard({
    member,
    showEra,
  }: {
    member: (typeof members extends (infer T)[] | null ? T : never);
    showEra?: boolean;
  }) {
    const hosted = hostedMap.get(member.id) || 0;
    const nominated = nominationMap.get(member.id) || 0;
    const isCurrentUser = member.id === user!.memberId;
    const bioTease = member.bio
      ? member.bio.split(". ")[0].replace(/\.$/, "") + "."
      : null;

    const era = showEra
      ? parseEra(member.joined_info, member.left_info)
      : null;

    const card = (
      <Link href={`/members/${member.id}`} className="group block">
        <Card className="h-full hover:border-border-light transition-colors">
          <CardContent>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-semibold text-foreground group-hover:text-amber transition-colors">
                  {member.full_name}
                </h3>
                {era ? (
                  <p className="text-muted text-xs mt-1">{era}</p>
                ) : (
                  member.joined_info && (
                    <p className="text-muted text-xs mt-1">
                      {member.joined_info}
                    </p>
                  )
                )}
              </div>
              <Badge variant={roleBadgeVariant(member.role)}>
                {roleLabel(member.role)}
              </Badge>
            </div>

            {bioTease && (
              <p className="text-xs text-secondary italic mt-2 line-clamp-2">
                {bioTease}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3">
              {hosted > 0 && (
                <div className="flex items-center gap-1.5 text-secondary">
                  <Home className="w-3.5 h-3.5" />
                  <span className="font-mono text-sm font-medium text-foreground">
                    {hosted}
                  </span>
                </div>
              )}
              {nominated > 0 && (
                <div className="flex items-center gap-1.5 text-secondary">
                  <BookMarked className="w-3.5 h-3.5" />
                  <span className="font-mono text-sm font-medium text-foreground">
                    {nominated}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );

    return (
      <PersonalizedHighlight isYours={isCurrentUser}>
        {card}
      </PersonalizedHighlight>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold">Members</h1>
        <p className="text-secondary mt-1">
          The people of Book Club Manager
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-secondary">
          <Users className="w-4 h-4" />
          <span className="text-sm">
            <span className="font-mono font-bold text-foreground">
              {currentMembers.length}
            </span>{" "}
            active members
          </span>
        </div>
        {formerMembers.length > 0 && (
          <div className="flex items-center gap-2 text-secondary">
            <GraduationCap className="w-4 h-4" />
            <span className="text-sm">
              <span className="font-mono font-bold text-foreground">
                {formerMembers.length}
              </span>{" "}
              alumni
            </span>
          </div>
        )}
      </div>

      {/* Current Members */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-amber" />
          <h2 className="font-heading text-xl font-semibold">
            Current members
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
        {currentMembers.length === 0 && (
          <p className="text-muted text-sm py-4">No current members.</p>
        )}
      </section>

      {/* Alumni */}
      {formerMembers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-4 h-4 text-muted" />
            <h2 className="font-heading text-xl font-semibold text-secondary">
              Alumni
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {formerMembers.map((member) => (
              <MemberCard key={member.id} member={member} showEra />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
