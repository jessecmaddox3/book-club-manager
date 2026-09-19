import { cn } from "@/lib/cn";
import { Badge } from "./badge";

interface PersonalizedHighlightProps {
  isYours: boolean;
  children: React.ReactNode;
  className?: string;
  showBadge?: boolean;
}

export function PersonalizedHighlight({
  isYours,
  children,
  className,
  showBadge = true,
}: PersonalizedHighlightProps) {
  if (!isYours) return <>{children}</>;

  return (
    <div
      className={cn(
        "relative ring-2 ring-amber/40 rounded-xl bg-amber/5",
        className
      )}
    >
      {showBadge && (
        <Badge variant="you" className="absolute -top-2.5 right-3 z-10">
          You
        </Badge>
      )}
      {children}
    </div>
  );
}
