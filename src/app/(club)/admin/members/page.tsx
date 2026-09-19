import { getUser } from "@/lib/session";
import { getRepository } from "@/lib/store";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Shield, UserX } from "lucide-react";
import { MemberActions, AddMemberForm } from "./member-manager";

export const metadata = {
  title: "Book Club Manager · Members admin",
};

export default async function AdminMembersPage() {
  const user = await getUser();
  if (!user || user.role !== "admin") redirect("/");

  const members=await(await getRepository()).adminMembers();

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
          <Users className="w-5 h-5 text-amber" />
          <h1 className="font-heading text-3xl font-bold">Members</h1>
        </div>
        <p className="text-secondary mt-1">
          Who&apos;s in, who&apos;s out, who&apos;s admin
        </p>
      </div>

      {/* Add member */}
      <AddMemberForm />

      {/* Current members */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-amber" />
          <h2 className="font-heading text-xl font-semibold">
            Active members ({currentMembers.length})
          </h2>
        </div>

        {currentMembers.length > 0 ? (
          <div className="space-y-2">
            {currentMembers.map((member) => (
              <Card key={member.id}>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {member.full_name}
                          </h3>
                          <Badge variant={roleBadgeVariant(member.role)}>
                            {roleLabel(member.role)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {member.display_name !== member.full_name && (
                            <span className="text-xs text-muted">
                              &quot;{member.display_name}&quot;
                            </span>
                          )}
                          {member.email && (
                            <span className="text-xs text-muted truncate">
                              {member.email}
                            </span>
                          )}
                          {member.joined_info && (
                            <span className="text-xs text-muted">
                              {member.joined_info}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <MemberActions
                      memberId={member.id}
                    initialRevision={member.revision}
                      currentRole={member.role}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-secondary">No active members.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alumni */}
      {formerMembers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <UserX className="w-4 h-4 text-muted" />
            <h2 className="font-heading text-xl font-semibold text-secondary">
              Alumni ({formerMembers.length})
            </h2>
          </div>

          <div className="space-y-2">
            {formerMembers.map((member) => (
              <Card key={member.id} className="opacity-60">
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {member.full_name}
                      </h3>
                      {member.email && (
                        <span className="text-xs text-muted">{member.email}</span>
                      )}
                    </div>

                    <MemberActions
                      memberId={member.id}
                    initialRevision={member.revision}
                      currentRole={member.role}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
