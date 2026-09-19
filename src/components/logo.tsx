// Book Club Manager emblem: an open book with a rocks glass resting on it.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* open book */}
      <path d="M12 9.5c-2.3-1.3-4.8-1.5-7.3-0.6v9.2c2.5-0.9 5-0.7 7.3 0.6 2.3-1.3 4.8-1.5 7.3-0.6V8.9c-2.5-0.9-5-0.7-7.3 0.6z" />
      <path d="M12 9.5v9.4" />
      {/* rocks glass with a pour line */}
      <path d="M9.4 3.2h5.2l-0.7 4.1h-3.8z" />
      <path d="M9.9 5.6h4.2" />
    </svg>
  );
}
