import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Tool not found</h1>
        <p className="text-muted-foreground">The tool you are looking for may have moved or no longer exists.</p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        Back to tools
      </Link>
    </main>
  );
}
