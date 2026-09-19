"use client";
import {useActorId} from "@/components/actor-context";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import {
  BookOpen,
  Sparkles,
  Loader2,
  FileText,
  Clock,
  Plus,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Recommendation {
  title: string;
  author: string;
  description: string;
  whyRecommend: string;
  pageCount: number | null;
  audiobookLength: string | null;
}

export default function BookRecommendPage({aiEnabled,demo}:{aiEnabled:boolean;demo:boolean}) {
  const actorId=useActorId();
  const [preferences, setPreferences] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nominated, setNominated] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if(demo){
      setRecommendations([
       {title:'The Cartographer’s Breakfast',author:'P. Saffron',description:'An invented mystery about a map tucked inside an old cookbook.',whyRecommend:'A fictional example of a short, conversation-friendly mystery.',pageCount:224,audiobookLength:null},
       {title:'A Field Guide to Borrowed Time',author:'H. Kestrel',description:'An invented science-fiction story about a librarian who lends people an extra hour.',whyRecommend:'An example with an unusual premise and an ethical question to discuss.',pageCount:272,audiobookLength:'7 hours (fictional)'},
       {title:'The Secret Life of Doorbells',author:'W. Maple',description:'An invented nonfiction example tracing everyday inventions through their surprising histories.',whyRecommend:'An example of accessible nonfiction with room for tangents.',pageCount:208,audiobookLength:null},
      ]);return;
    }
    setLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({
          preferences: preferences.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Couldn't get recommendations. Try again.");
      }

      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get recommendations. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleNominate(book: Recommendation) {
    const key = `${book.title}::${book.author}`;
    if (nominated.has(key)) return;
    setSubmitting(key);

    try {
      const res = await fetch("/api/books/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          description: book.description,
          pageCount: book.pageCount,
          audiobookLength: book.audiobookLength,
        }),
      });

      if (!res.ok) throw new Error("Couldn't put that in the hat. Try again.");
      setNominated((prev) => new Set([...prev, key]));
      toast.success(`${book.title} is in the hat for the next ballot.`);
    } catch {
      toast.error("Couldn't put that in the hat. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/books">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Books
          </Button>
        </Link>
        <h1 className="font-heading text-3xl font-bold">
          Find my next read
        </h1>
        <p className="text-secondary mt-1">
          Say what you&apos;re in the mood for. It steers around the assigned reading.
        </p>
      </div>

      {demo?<p className="rounded-lg border border-amber/30 bg-amber/10 p-4 text-sm text-secondary">Try the recommendation-to-nomination flow with invented example books. These are not real books or live AI results.</p>:<p className="text-sm text-muted">{aiEnabled?'This sends your preferences and the club’s read-book titles to your configured AI provider. Check its suggestions before nominating.':'Optional AI recommendations are off. You can still enter any book manually.'} <Link href="/books/submit" className="text-amber underline">Enter a book</Link></p>}
      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <Input
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder='Optional: "shorter books" or "something about psychology" or just hit Recommend'
          disabled={loading||(!aiEnabled&&!demo)}
          className="flex-1"
        />
        <Button type="submit" disabled={loading||(!aiEnabled&&!demo)}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading ? "Thinking..." : demo?"Try example suggestions":"Recommend"}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-error/20 bg-error/5 p-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent>
                <div className="flex gap-4">
                  <div className="w-20 h-[120px] bg-card-hover rounded-md shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-card-hover rounded w-2/3" />
                    <div className="h-4 bg-card-hover rounded w-1/3" />
                    <div className="h-3 bg-card-hover rounded w-full" />
                    <div className="h-3 bg-card-hover rounded w-5/6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-secondary">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">
              <span className="font-mono font-bold text-foreground">
                {recommendations.length}
              </span>{" "}
              recommendations
            </span>
          </div>

          {recommendations.map((rec, i) => {
            const key = `${rec.title}::${rec.author}`;
            const isNominated = nominated.has(key);
            const isSubmitting = submitting === key;

            return (
              <Card key={i} className={isNominated ? "border-success/30 bg-success/5" : ""}>
                <CardContent>
                  <div className="flex gap-4">
                    <BookCover title={rec.title} author={rec.author} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-heading text-lg font-semibold text-foreground">
                            {rec.title}
                          </h3>
                          <p className="text-secondary text-sm">{rec.author}</p>
                        </div>
                        {isNominated ? (
                          <Badge variant="success" className="shrink-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Nominated
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleNominate(rec)}
                            disabled={isSubmitting}
                            className="shrink-0"
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            Nominate
                          </Button>
                        )}
                      </div>

                      <p className="text-sm text-secondary mt-3">
                        {rec.description}
                      </p>
                      <p className="text-xs text-amber mt-2 italic">
                        {rec.whyRecommend}
                      </p>

                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {rec.pageCount && (
                          <div className="flex items-center gap-1.5 text-muted">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono">
                              {rec.pageCount} pages
                            </span>
                          </div>
                        )}
                        {rec.audiobookLength && (
                          <div className="flex items-center gap-1.5 text-muted">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono">
                              {rec.audiobookLength}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && recommendations.length === 0 && !error && (
        <div className="text-center py-16">
          <Sparkles className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-secondary">
            Optional preferences above, then hit Recommend.
          </p>
        </div>
      )}
    </div>
  );
}
