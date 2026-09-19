"use client";
import {useActorId} from "@/components/actor-context";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { Plus, Loader2, Shield, User, UserX } from "lucide-react";
import { toast } from "sonner";

export function AddMemberForm() {
  const actorId=useActorId();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");

  async function handleAdd() {
    if (!fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({
          action: "create",
          fullName: fullName.trim(),
          displayName: displayName.trim() || fullName.trim(),
          email: email.trim() || null,
          role,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Couldn't add them. Try again.");
      }

      toast.success(`${fullName.trim()} is in.`);
      setFormOpen(false);
      setFullName("");
      setDisplayName("");
      setEmail("");
      setRole("member");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add them. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!formOpen) {
    return (
      <Button onClick={() => setFormOpen(true)} className="gap-2">
        <Plus className="w-4 h-4" />
        Add member
      </Button>
    );
  }

  return (
    <Card className="border-amber/20">
      <CardHeader>
        <CardTitle>Add new member</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-secondary mb-1.5 block">
              Full name <span className="text-error">*</span>
            </label>
            <Input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="text-sm text-secondary mb-1.5 block">
              Display name
            </label>
            <Input
              placeholder="Name shown in the club"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="text-sm text-secondary mb-1.5 block">
              Email (optional)
            </label>
            <Input
              type="email"
              placeholder="reader@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="text-sm text-secondary mb-1.5 block">Role</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRole("member")}
                className={cn(
                  "flex-1 h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                  role === "member"
                    ? "bg-amber/10 border-amber/30 text-amber"
                    : "bg-card border-border text-secondary hover:text-foreground"
                )}
              >
                Member
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={cn(
                  "flex-1 h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                  role === "admin"
                    ? "bg-amber/10 border-amber/30 text-amber"
                    : "bg-card border-border text-secondary hover:text-foreground"
                )}
              >
                Admin
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Button onClick={handleAdd} disabled={submitting} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add member
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setFormOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MemberActions({
  memberId,
  currentRole,
  initialRevision,
}: {
  memberId: string;
  currentRole: string;
  initialRevision:number;
}) {
  const actorId=useActorId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [revision,setRevision]=useState(initialRevision);

  async function handleRoleChange(newRole: string) {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({
          action: "updateRole",
          memberId,
          role: newRole,
          revision,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Couldn't change that role. Try again.");
      }

      setRevision((await response.json()).revision);
      toast.success("Role updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change that role. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted" />
      ) : (
        <>
          {currentRole !== "admin" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRoleChange("admin")}
              title="Make admin"
            >
              <Shield className="w-4 h-4" />
            </Button>
          )}
          {currentRole !== "member" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRoleChange("member")}
              title="Make member"
            >
              <User className="w-4 h-4" />
            </Button>
          )}
          {currentRole !== "former" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRoleChange("former")}
              title="Mark as alumni"
            >
              <UserX className="w-4 h-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
