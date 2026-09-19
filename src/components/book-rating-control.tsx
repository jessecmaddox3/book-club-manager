"use client";
import {useActorId} from "@/components/actor-context";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, X, UserX, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

type Status = "read" | "did_not_read" | "did_not_attend";

interface Props {
  meetingId: string;
  bookId: string;
  initialRevision: number;
  initialRating: number | null;
  initialStatus: Status | 'unrated' | null;
}

export function BookRatingControl({ meetingId, bookId, initialRevision, initialRating, initialStatus }: Props) {
  const actorId=useActorId();
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [status, setStatus] = useState<Status | null>(initialStatus==='unrated'?null:initialStatus);
  const [revision,setRevision]=useState(initialRevision);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(nextStatus: Status|'clear', nextRating: number | null) {
    const previousStatus = status;
    const previousRating = rating;
    setSaving(true);
    setStatus(nextStatus==='clear'?null:nextStatus);
    setRating(nextStatus === "read" ? nextRating : null);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({ meetingId, bookId, revision, status: nextStatus, rating: nextRating }),
      });
      const data=await res.json();
      if (!res.ok) throw new Error(data.error??'Failed to save');
      setRevision(data.revision);
      toast.success(
        nextStatus==='clear'?'Verdict cleared.':nextStatus === "read"
          ? "Verdict recorded."
          : nextStatus === "did_not_read"
            ? "Noted: didn't get to it."
            : "Noted: weren't there."
      );
      router.refresh();
    } catch(error) {
      setStatus(previousStatus);
      setRating(previousRating);
      toast.error(error instanceof Error?error.message:"Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const active = hover ?? rating ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className={cn(
          "flex items-center gap-1",
          status && status !== "read" && "opacity-40"
        )}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={saving}
            onMouseEnter={() => setHover(n)}
            onClick={() => save("read", n)}
            className="p-0.5 cursor-pointer disabled:cursor-wait"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                "w-6 h-6 transition-colors",
                n <= active && status !== "did_not_read" && status !== "did_not_attend"
                  ? "fill-amber text-amber"
                  : "text-muted"
              )}
            />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save("did_not_read", null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer",
            status === "did_not_read"
              ? "border-amber/40 bg-amber/10 text-amber"
              : "border-border text-secondary hover:text-foreground"
          )}
        >
          <X className="w-3.5 h-3.5" />
          Didn&apos;t read it
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => save("did_not_attend", null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer",
            status === "did_not_attend"
              ? "border-amber/40 bg-amber/10 text-amber"
              : "border-border text-secondary hover:text-foreground"
          )}
        >
          <UserX className="w-3.5 h-3.5" />
          Wasn&apos;t there
        </button>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
        {status&&<button type="button" disabled={saving} onClick={()=>save('clear',null)} className="text-xs text-muted underline">Clear verdict</button>}
      </div>
    </div>
  );
}
