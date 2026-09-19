"use client";
import {useActorId} from "@/components/actor-context";

import { useState } from "react";
import {useRouter} from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import {
  Search,
  Sparkles,
  Loader2,
  BookOpen,
  Clock,
  FileText,
  Star,
  CheckCircle2,
  Plus,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface BookResult {
  title: string;
  author: string;
  description: string;
  whyMatch?: string;
  whyRecommend?: string;
  pageCount: number | null;
  audiobookLength: string | null;
  goodreadsRating?: number | null;
}

type SearchMode = "ai" | "manual";

export default function BookSubmitPage({aiEnabled}:{aiEnabled:boolean}) {
  const actorId=useActorId();
  const router=useRouter();
  const [mode, setMode] = useState<SearchMode>("manual");
  const [query, setQuery] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [useAiLookup,setUseAiLookup]=useState(false);
  const [manualDescription,setManualDescription]=useState('');
  const [manualPages,setManualPages]=useState('');
  const [manualAudio,setManualAudio]=useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nominated, setNominated] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleAiSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/ai/book-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Couldn't search. Try again.");
      }

      const data = await res.json();
      setResults(data.books || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't search. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleManualLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim() || !manualAuthor.trim()) return;

    if(!useAiLookup){
      setError(null);
      setResults([{title:manualTitle.trim(),author:manualAuthor.trim(),description:manualDescription.trim(),pageCount:manualPages?Number(manualPages):null,audiobookLength:manualAudio.trim()||null}]);
      return;
    }
    setLookingUp(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/ai/book-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bookclub-actor":actorId },
        body: JSON.stringify({
          title: manualTitle.trim(),
          author: manualAuthor.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Couldn't look that up. Try again.");
      }

      const data = await res.json();
      setResults([data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't look that up. Try again.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleNominate(book: BookResult) {
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
          goodreadsRating: book.goodreadsRating,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Couldn't put that in the hat. Try again.");
      }

      setNominated((prev) => new Set([...prev, key]));
      toast.success(`${book.title} is in the hat for the next ballot.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't put that in the hat. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const isSearching = loading || lookingUp;

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
        <h1 className="font-heading text-3xl font-bold">Put a book in the hat</h1>
        <p className="text-secondary mt-1">
          Find one and put it in the hat. It goes on the shortlist for the next ballot.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "ai" ? "default" : "secondary"}
          size="sm"
          disabled={!aiEnabled}
          onClick={() => { setMode("ai"); setResults([]); setError(null); }}
        >
          <Sparkles className="w-4 h-4" />
          Search by description
        </Button>
        <Button
          variant={mode === "manual" ? "default" : "secondary"}
          size="sm"
          onClick={() => { setMode("manual"); setResults([]); setError(null); }}
        >
          <BookOpen className="w-4 h-4" />
          Enter a title
        </Button>
      </div>

      <p className="text-xs text-muted">{aiEnabled?'AI suggestions can be wrong. Check the book and details before nominating it.':'AI is off. Manual nominations work entirely inside your club.'}</p>

      {/* AI search mode */}
      {mode === "ai" && (
        <form onSubmit={handleAiSearch} className="space-y-3">
          <label className="block text-sm text-secondary">
            Describe the kind of book you&apos;re looking for
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "a page-turner about espionage" or "something about behavioral economics, under 300 pages"'
              disabled={isSearching}
              className="flex-1"
            />
            <Button type="submit" disabled={isSearching || !query.trim()}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Searching..." : "Find books"}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Searches books by description and skips anything the club has already read.
          </p>
        </form>
      )}

      {/* Manual mode */}
      {mode === "manual" && (
        <form onSubmit={handleManualLookup} className="space-y-3">
          <label className="block text-sm text-secondary">
            Enter a title and author. Other details are optional.
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              aria-label="Book title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Book title"
              disabled={isSearching}
              className="flex-1"
            />
            <Input
              aria-label="Author"
              value={manualAuthor}
              onChange={(e) => setManualAuthor(e.target.value)}
              placeholder="Author"
              disabled={isSearching}
              className="w-full sm:w-48"
            />
            <Button
              type="submit"
              disabled={
                isSearching || !manualTitle.trim() || !manualAuthor.trim()
              }
            >
              {lookingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {lookingUp ? "Looking up..." : "Preview book"}
            </Button>
          </div>
          <label className="block text-sm text-secondary">Short description (optional)<textarea value={manualDescription} onChange={e=>setManualDescription(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-card p-3" maxLength={2000}/></label>
          <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm text-secondary">Pages (optional)<Input type="number" min="1" step="1" value={manualPages} onChange={e=>setManualPages(e.target.value)}/></label><label className="text-sm text-secondary">Audiobook length (optional)<Input value={manualAudio} onChange={e=>setManualAudio(e.target.value)} placeholder="e.g. 8 hours"/></label></div>
          {aiEnabled&&<label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" checked={useAiLookup} onChange={e=>setUseAiLookup(e.target.checked)}/> Fill details with AI. This sends the title and author to your configured provider.</label>}
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-error/20 bg-error/5 p-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isSearching && (
        <div className="space-y-4">
          {Array.from({ length: mode === "manual" ? 1 : 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent>
                <div className="flex gap-4">
                  <div className="w-20 h-[120px] bg-card-hover rounded-md" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-card-hover rounded w-2/3" />
                    <div className="h-4 bg-card-hover rounded w-1/3" />
                    <div className="h-3 bg-card-hover rounded w-full" />
                    <div className="h-3 bg-card-hover rounded w-5/6" />
                    <div className="flex gap-4 mt-2">
                      <div className="h-4 bg-card-hover rounded w-20" />
                      <div className="h-4 bg-card-hover rounded w-24" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {!isSearching && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-secondary">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">
              <span className="font-mono font-bold text-foreground">
                {results.length}
              </span>{" "}
              {results.length === 1 ? "result" : "results"}
            </span>
          </div>

          {results.map((book, i) => {
            const key = `${book.title}::${book.author}`;
            const isNominated = nominated.has(key);
            const isSubmitting = submitting === key;

            return (
              <Card key={i} className={isNominated ? "border-success/30 bg-success/5" : ""}>
                <CardContent>
                  <div className="flex gap-4">
                    <BookCover
                      title={book.title}
                      author={book.author}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-heading text-lg font-semibold text-foreground">
                            {book.title}
                          </h3>
                          <p className="text-secondary text-sm">
                            {book.author}
                          </p>
                        </div>
                        {isNominated ? (
                          <Badge variant="success" className="shrink-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Nominated
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleNominate(book)}
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

                      {/* Description */}
                      <p className="text-sm text-secondary mt-3">
                        {book.description}
                      </p>

                      {/* Why match/recommend */}
                      {(book.whyMatch || book.whyRecommend) && (
                        <p className="text-xs text-amber mt-2 italic">
                          {book.whyMatch || book.whyRecommend}
                        </p>
                      )}

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {book.pageCount && (
                          <div className="flex items-center gap-1.5 text-muted">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono">
                              {book.pageCount} pages
                            </span>
                          </div>
                        )}
                        {book.audiobookLength && (
                          <div className="flex items-center gap-1.5 text-muted">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono">
                              {book.audiobookLength}
                            </span>
                          </div>
                        )}
                        {book.goodreadsRating && (
                          <div className="flex items-center gap-1.5 text-muted">
                            <Star className="w-3.5 h-3.5 fill-amber text-amber" />
                            <span className="text-xs font-mono">
                              {Number(book.goodreadsRating).toFixed(1)}
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
      {!isSearching && results.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-muted" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
            {mode === "ai"
              ? "Describe what you're in the mood for"
              : "Enter a title and author"}
          </h2>
          <p className="text-secondary text-sm max-w-md mx-auto">
            {mode === "ai"
              ? "Say what you're in the mood for and a few options come back with page counts and audio lengths."
              : "Enter the title and author, add any details you know, then preview your suggestion."}
          </p>
        </div>
      )}
    </div>
  );
}
