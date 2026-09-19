"use client";
import {useActorId} from "@/components/actor-context";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  StickyNote,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface MeetingResultsFormProps {
  meetingId: string;
  initialRevision:number;
  meetingNumber: number;
  existingNotes?: string | null;
}

export function MeetingResultsForm({
  meetingId,
  initialRevision,
  meetingNumber,
  existingNotes,
}: MeetingResultsFormProps) {
  const actorId=useActorId();
  const router = useRouter();
  const [revision,setRevision]=useState(initialRevision);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState(existingNotes ?? "");

  async function handleSave() {
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({
          action: "recordResults",
          meetingId,
          revision,
          notes: notes.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Couldn't save those notes. Try again.");
      }

      setRevision((await response.json()).revision);
      toast.success(`Meeting #${meetingNumber} notes saved.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save those notes. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-secondary hover:text-foreground transition-colors cursor-pointer w-full"
      >
        <StickyNote className="w-3.5 h-3.5" />
        <span>Meeting notes</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-5">
          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <StickyNote className="w-4 h-4 text-amber" />
              Notes
            </label>
            <textarea
              placeholder="Meeting notes, discussion highlights..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
              className="flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50 focus-visible:border-amber/50 resize-y"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save notes
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setExpanded(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
