"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";

interface BookCoverProps {
  title: string;
  author?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  coverUrl?: string | null;
}

export function BookCover({ title, author, size = "md", className,coverUrl }: BookCoverProps) {
  const [error, setError] = useState(false);

  const dimensions = {
    sm: { width: 48, height: 72, icon: "w-4 h-4", text: "text-[10px]" },
    md: { width: 80, height: 120, icon: "w-5 h-5", text: "text-xs" },
    lg: { width: 128, height: 192, icon: "w-7 h-7", text: "text-sm" },
  }[size];

  const localCover=coverUrl&&/^\/covers\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)$/.test(coverUrl)?coverUrl:null;
  if (error || !localCover) {
    const initials = title
      .replace(/^(The|A|An)\s+/i, "")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return (
      <div
        className={cn(
          "flex-shrink-0 flex flex-col items-center justify-center rounded-md bg-gradient-to-br from-[#2a2419] to-[#1a1612] border border-border",
          className
        )}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <BookOpen className={cn("text-amber/40 mb-1", dimensions.icon)} />
        <span className={cn("text-amber/60 font-mono font-bold", dimensions.text)}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={localCover}
      alt={`Cover of ${title}${author ? ` by ${author}` : ""}`}
      width={dimensions.width}
      height={dimensions.height}
      className={cn(
        "flex-shrink-0 rounded-md object-cover border border-border/50",
        className
      )}
      onError={() => setError(true)}
      unoptimized
    />
  );
}
