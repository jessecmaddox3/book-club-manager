import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-amber/15 text-amber border border-amber/20",
        secondary: "bg-card text-secondary border border-border",
        success: "bg-success/15 text-success border border-success/20",
        error: "bg-error/15 text-error border border-error/20",
        warning: "bg-warning/15 text-warning border border-warning/20",
        you: "bg-amber/20 text-amber border-2 border-amber/40 font-semibold shadow-[0_0_10px_rgba(226,166,61,0.15)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
