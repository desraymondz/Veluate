"use client";

import { ExternalLink } from "lucide-react";

type Props = {
  url: string;
  title: string;
  compact?: boolean;
};

export function ClipPlayer({ url, title, compact = false }: Props) {
  const isVideoDbPlayer = /player\.videodb\.io/i.test(url);
  const embedUrl = isVideoDbPlayer ? url.replace("/watch?", "/embed?") : url;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {isVideoDbPlayer ? (
        <iframe
          src={embedUrl}
          title={title}
          className="aspect-video w-full border border-border bg-foreground"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          controls
          className="aspect-video w-full border border-border bg-foreground object-cover"
          src={url}
          title={title}
        >
          Your browser does not support video playback.
        </video>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Open clip
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
