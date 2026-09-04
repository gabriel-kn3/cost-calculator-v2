/**
 * Placeholder for screens still being ported.
 *
 * Exists because the previous build routed every unported path to the
 * Dashboard, which was indistinguishable from broken navigation. A screen
 * that is not ready should say so.
 */
import { Link } from "react-router-dom";
import { Hammer, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";

export default function ComingSoonPage({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle="Being rebuilt" />
      <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blush-bg text-blush-fg">
          <Hammer className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">This screen is still being ported.</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            The original is still available meanwhile — run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              npm run dev:legacy
            </code>
            .
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Back to dashboard <ArrowRight className="size-3.5" />
        </Link>
      </Card>
    </>
  );
}
