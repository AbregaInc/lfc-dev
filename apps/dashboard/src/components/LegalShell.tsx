import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 md:px-6">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xs font-semibold tracking-[0.12em] text-primary-foreground shadow-sm">
            LFC
          </Link>
          <Link to="/" className="text-sm font-medium text-foreground hover:text-foreground/80">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-foreground">
          {children}
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/acceptable-use" className="hover:text-foreground">Acceptable Use</Link>
        </div>
      </footer>
    </div>
  );
}
