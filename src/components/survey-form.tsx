"use client";
import {useActorId} from "@/components/actor-context";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {BookCover} from "@/components/book-cover";
import type {PreviousBook} from "@/lib/ballots/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Star, Home, GlassWater, Send, Check, Loader2, BookOpen, ThumbsUp, ThumbsDown, Clock, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";

interface SurveyBook {
  id: string;
  title: string;
  subtitle?: string | null;
  author: string;
  coverImage: string|null;
  goodreadsRating: number | null;
  pages: number | null;
  audiobookLength: string | null;
  description: string;
  whyLike: string;
  whyNot: string;
}

interface DateOption {
  id: string;
  label: string;
  week: number;
}

interface WeekOption {
  week: number;
  label: string;
  dates: DateOption[];
}

interface SurveyFormProps {
  surveyId: string;
  ballotId:string;
  ballotRevision:number;
  books: SurveyBook[];
  dateOptions: DateOption[];
  weeks: WeekOption[];
  previousBook: PreviousBook | null;
  existingResponse: {
    ratings: Record<string, number>;
    willingToHost: boolean;
    willingToBringBourbon: boolean;
    revision:number;
    datePreferences: Record<string, string>;
  } | null;
}

const VOTE_WORDS = ["", "No way", "Meh", "It's fine", "I'm in", "Let's read it"];
const LIKE_WORDS = ["", "Hated it", "Meh", "It was fine", "Liked it", "Loved it"];

function StarRating({
  value,
  onChange,
  disabled,
  lowLabel = "No way",
  highLabel = "Definitely",
  words = VOTE_WORDS,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  lowLabel?: string;
  highLabel?: string;
  words?: string[];
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div>
      <div
        className="flex items-center gap-1 sm:gap-3"
        onMouseLeave={() => setHovered(0)}
      >
        <span className="text-xs sm:text-sm text-muted text-right shrink-0 w-12 sm:w-16">
          {lowLabel}
        </span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHovered(star)}
              onClick={() => onChange(star)}
              className={cn(
                "p-0.5 transition-colors cursor-pointer",
                disabled && "cursor-not-allowed opacity-50"
              )}
              aria-label={`${star} star${star !== 1 ? "s" : ""}: ${words[star]}`}
            >
              <Star
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 transition-colors",
                  shown >= star ? "text-amber fill-amber" : "text-muted"
                )}
              />
            </button>
          ))}
        </div>
        <span className="text-xs sm:text-sm text-muted shrink-0 w-12 sm:w-16">
          {highLabel}
        </span>
      </div>
      <p
        className={cn(
          "text-sm font-medium mt-2 h-5 transition-colors",
          shown > 0 ? "text-amber" : "text-transparent"
        )}
      >
        {words[shown] || " "}
      </p>
    </div>
  );
}

export function SurveyForm({
  surveyId,
  ballotId,
  ballotRevision,
  books,
  dateOptions,
  weeks,
  previousBook,
  existingResponse,
}: SurveyFormProps) {
  const actorId=useActorId();
  const router = useRouter();
  const [ratings, setRatings] = useState<Record<string, number>>(
    existingResponse?.ratings ?? {}
  );
  const [willingToHost, setWillingToHost] = useState(
    existingResponse?.willingToHost ?? false
  );
  const [willingToBringBourbon, setWillingToBringBourbon] = useState(
    existingResponse?.willingToBringBourbon ?? false
  );
  const [previousBookRating, setPreviousBookRating] = useState<number>(
    previousBook?.verdict.rating ?? 0
  );
  const [previousStatus,setPreviousStatus]=useState<string>(previousBook?.verdict.status??'unrated');
  const [previousDirty,setPreviousDirty]=useState(false);
  const [previousRevision,setPreviousRevision]=useState(previousBook?.verdict.revision??0);
  const [responseRevision,setResponseRevision]=useState(existingResponse?.revision??0);
  const [datePreferences, setDatePreferences] = useState<Record<string, string>>(
    existingResponse?.datePreferences ??
      Object.fromEntries(dateOptions.map((d) => [d.id, "yes"]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingResponse);

  function setRating(bookId: string, rating: number) {
    setRatings((prev) => ({ ...prev, [bookId]: rating }));
  }

  const ratedCount = books.filter((b) => ratings[b.id] > 0).length;
  const allRated = ratedCount === books.length;

  async function handleSubmit() {
    if (!allRated) {
      toast.error(`Rate all ${books.length} books first.`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({
          surveyId,
          ratings,
          willingToHost,
          willingToBringBourbon,
          ballotId,ballotRevision,responseRevision,
          ...(previousDirty&&previousBook?{verdictChange:{meetingId:previousBook.meetingId,bookId:previousBook.bookId,revision:previousRevision,status:previousStatus==='unrated'?'clear':previousStatus,rating:previousStatus==='read'?previousBookRating:null}}:{}),
          datePreferences,
        }),
      });

      const data=await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Couldn't save your ballot. Try again.");
      }

      setResponseRevision(data.revision);
      if(data.verdict)setPreviousRevision(data.verdict.revision);
      setPreviousDirty(false);
      setSubmitted(true);
      toast.success("Ballot's in. Cheers.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your ballot. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Last book, first thing. Only when there is a previous book to grade. */}
      {previousBook && (
        <Card>
          <CardContent>
            <h3 className="font-heading text-xl font-semibold text-foreground mb-1">
              How much did you like the last book?
            </h3>
            <p className="text-secondary text-base mb-4">
              <span className="text-foreground font-medium">{previousBook.title}</span> by{" "}
              {previousBook.author}
            </p>
            <StarRating
              value={previousBookRating}
              onChange={value=>{setPreviousBookRating(value);setPreviousStatus('read');setPreviousDirty(true);}}
              disabled={submitting}
              lowLabel="Hated it"
              highLabel="Loved it"
              words={LIKE_WORDS}
            />
            <div className="flex flex-wrap gap-2 mt-2">{([['did_not_read',"Didn’t read it"],['did_not_attend',"Wasn’t there"],['unrated','Clear verdict']] as const).map(([status,label])=><button key={status} type="button" disabled={submitting} onClick={()=>{setPreviousStatus(status);setPreviousBookRating(0);setPreviousDirty(true);}} className={cn('rounded-lg border px-3 py-2 text-xs',previousStatus===status?'border-amber/40 text-amber':'border-border text-secondary')}>{label}</button>)}</div>
            <p className="text-xs text-muted mt-2">Your last-book verdict is saved with this ballot only if you change it here.</p>
          </CardContent>
        </Card>
      )}

      {/* The actual voting */}
      <div className="flex items-center gap-2 pt-2">
        <BookOpen className="w-5 h-5 text-amber shrink-0" />
        <div>
          <h2 className="font-heading text-2xl font-semibold leading-tight">
            Now vote: {books.length} on the ballot
          </h2>
          <p className="text-sm text-muted">
            Rate every one. 1 star means no way, 5 means let&apos;s read it.
          </p>
        </div>
      </div>

      {/* Book cards */}
      {books.map((book) => (
        <Card key={book.id}>
          <CardContent>
            <div className="flex gap-4 sm:gap-6">
              {/* Cover image */}
              <div className="shrink-0">
                <BookCover title={book.title} author={book.author} coverUrl={book.coverImage} size="lg" />
              </div>

              {/* Book details */}
              <div className="flex-1 min-w-0">
                {/* Title + rating badge */}
                <div className="flex flex-wrap items-start gap-2 mb-1">
                  <h3 className="font-heading text-xl sm:text-2xl font-semibold text-foreground leading-tight">
                    {book.title}
                  </h3>
                  <span className="text-sm font-mono text-amber bg-amber/10 px-2 py-0.5 rounded shrink-0 mt-1">
                    {book.goodreadsRating != null ? book.goodreadsRating.toFixed(2) : "New"}
                  </span>
                </div>
                {book.subtitle && (
                  <p className="text-foreground/70 text-base italic mb-1">
                    {book.subtitle}
                  </p>
                )}
                <p className="text-secondary text-base">by {book.author}</p>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  {book.pages != null && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-muted" />
                      <span className="text-sm text-secondary">{book.pages} pages</span>
                    </div>
                  )}
                  {book.audiobookLength && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-muted" />
                      <span className="text-sm text-secondary">{book.audiobookLength}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-base text-secondary leading-relaxed mt-4 mb-4">
              {book.description}
            </p>

            {/* Why like / why not */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg bg-success/5 border border-success/15 px-4 py-3">
                <p className="text-sm font-medium text-success flex items-center gap-1.5 mb-1">
                  <ThumbsUp className="w-4 h-4" />
                  The case for
                </p>
                <p className="text-sm text-secondary leading-relaxed">{book.whyLike}</p>
              </div>
              <div className="rounded-lg bg-error/5 border border-error/15 px-4 py-3">
                <p className="text-sm font-medium text-error flex items-center gap-1.5 mb-1">
                  <ThumbsDown className="w-4 h-4" />
                  The case against
                </p>
                <p className="text-sm text-secondary leading-relaxed">{book.whyNot}</p>
              </div>
            </div>

            {/* Your vote */}
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-sm text-foreground font-medium mb-2">
                Your vote
              </p>
              <StarRating
                value={ratings[book.id] || 0}
                onChange={(v) => setRating(book.id, v)}
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Date preferences */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-amber" />
            <h3 className="font-heading text-xl font-semibold text-foreground">
              When can you meet?
            </h3>
          </div>
          <p className="text-secondary text-base mb-4">
            Everything&apos;s a yes by default. Just switch the nights that don&apos;t work.
          </p>
          <div className="space-y-5">
            {weeks.map((week) => {
              return (
                <div key={week.week}>
                  <p className="text-sm text-muted uppercase tracking-wide mb-2">
                    Week of {week.label}
                  </p>
                  <div className="space-y-2">
                    {week.dates.map((date) => (
                      <div
                        key={date.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                      >
                        <span className="text-base text-foreground font-medium w-48 shrink-0">
                          {date.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {(["yes", "maybe", "no"] as const).map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                setDatePreferences((prev) => ({
                                  ...prev,
                                  [date.id]: option,
                                }))
                              }
                              className={cn(
                                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border",
                                datePreferences[date.id] === option
                                  ? option === "yes"
                                    ? "bg-success/15 border-success/30 text-success"
                                    : option === "maybe"
                                    ? "bg-amber/15 border-amber/30 text-amber"
                                    : "bg-error/15 border-error/30 text-error"
                                  : "border-border text-muted hover:text-secondary hover:border-secondary",
                                submitting && "cursor-not-allowed opacity-50"
                              )}
                            >
                              {option === "yes"
                                ? "Yes"
                                : option === "maybe"
                                ? "Maybe"
                                : "No"}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardContent>
          <h3 className="font-heading text-xl font-semibold text-foreground mb-4">
            Any volunteers?
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={willingToHost}
                onChange={(e) => setWillingToHost(e.target.checked)}
                disabled={submitting}
                className="sr-only peer"
              />
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                  willingToHost
                    ? "bg-amber border-amber"
                    : "border-border group-hover:border-secondary"
                )}
              >
                {willingToHost && <Check className="w-3 h-3 text-[#0f0d0a]" />}
              </div>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-secondary" />
                <span className="text-base text-foreground">
                  I can host the next one
                </span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={willingToBringBourbon}
                onChange={(e) => setWillingToBringBourbon(e.target.checked)}
                disabled={submitting}
                className="sr-only peer"
              />
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                  willingToBringBourbon
                    ? "bg-amber border-amber"
                    : "border-border group-hover:border-secondary"
                )}
              >
                {willingToBringBourbon && (
                  <Check className="w-3 h-3 text-[#0f0d0a]" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <GlassWater className="w-4 h-4 text-secondary" />
                <span className="text-base text-foreground">
                  I can bring drinks
                </span>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-base text-muted">
          {allRated ? (
            <span className="text-success flex items-center gap-1.5">
              <Check className="w-5 h-5" />
              All {books.length} rated
            </span>
          ) : (
            <span>
              {ratedCount} of {books.length} rated
            </span>
          )}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!allRated || submitting}
          size="lg"
          className="gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : submitted ? (
            <>
              <Check className="w-4 h-4" />
              Update my vote
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit my vote
            </>
          )}
        </Button>
      </div>

      {submitted && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3">
          <p className="text-base text-success font-medium flex items-center gap-2">
            <Check className="w-4 h-4" />
            Vote&apos;s in. You can change it until the ballot closes.
          </p>
        </div>
      )}
    </div>
  );
}
