export default function BrandLogo({ className = "", compact = false }) {
  if (compact) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
        T
      </span>
    );
  }

  return (
    <img
      src="/brand-logo.png"
      alt="ThokStore"
      className={`h-auto max-w-full rounded-md bg-white p-1 shadow-sm ${className}`}
    />
  );
}
