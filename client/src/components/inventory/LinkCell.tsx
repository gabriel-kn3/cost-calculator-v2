/**
 * A material's purchase link, with a hover preview like WhatsApp or Jira.
 *
 * The preview is fetched only on hover (and cached by React Query), so a
 * 200-row table does not fire 200 requests. Touch screens have no hover, so a
 * tap simply opens the link.
 *
 * Previews are best-effort. Amazon serves a bot check to automated requests,
 * so its links usually fall back to the product name carried in the URL, or
 * just the domain -- the link itself always works.
 */
import * as HoverCard from "@radix-ui/react-hover-card";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Preview({ url, materialName }: { url: string; materialName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => api.linkPreview(url),
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  const host = data?.host ?? hostOf(url);
  return (
    <div className="flex flex-col gap-2">
      {data?.image ? (
        <img
          src={data.image}
          alt=""
          referrerPolicy="no-referrer"
          className="max-h-40 w-full rounded-md bg-muted object-contain"
        />
      ) : null}
      <div className="text-sm font-medium leading-snug">
        {data?.title || materialName}
      </div>
      {data?.description ? (
        <p className="line-clamp-3 text-xs text-muted-foreground">{data.description}</p>
      ) : null}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link2 className="size-3" />
        {data?.siteName || host}
      </div>
      {data && !data.ok ? (
        <p className="text-[11px] text-muted-foreground">
          {host.includes("amazon")
            ? "Amazon blocks automatic previews — the link still opens normally."
            : "No preview available for this page — the link still opens normally."}
        </p>
      ) : null}
    </div>
  );
}

export function LinkCell({
  url,
  materialName,
  className,
}: {
  url: string | null;
  materialName: string;
  className?: string;
}) {
  if (!url) return <span className="text-muted-foreground">–</span>;

  const anchor = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-primary transition-colors hover:bg-accent",
        className,
      )}
    >
      <ExternalLink className="size-3 shrink-0" />
      <span className="truncate">{hostOf(url)}</span>
    </a>
  );

  return (
    <HoverCard.Root openDelay={250} closeDelay={100}>
      <HoverCard.Trigger asChild>{anchor}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="rose-card z-50 w-80 p-3 shadow-lg"
        >
          <Preview url={url} materialName={materialName} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
