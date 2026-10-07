"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import styles from "@/app/feed/feed.module.css";

export function FeedPostImage({ generationId }: { generationId: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  function retry() {
    setAttempt(attempt + 1);
    setStatus("loading");
  }

  return (
    <div className={styles.image} data-loaded={status === "loaded" ? "true" : undefined}>
      {status === "failed" ? (
        <div className={styles.imageFailure} role="status">
          <Icon name="camera" />
          <p>Photo didn&apos;t load.</p>
          <button className="button secondary" type="button" onClick={retry}>Retry</button>
        </div>
      ) : (
        <>
          {status === "loading" && <div className={styles.imageSkeleton} aria-hidden="true" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={attempt}
            src={`/feed/images/${encodeURIComponent(generationId)}?retry=${attempt}`}
            alt="Published photo for the caption below"
            loading="lazy"
            decoding="async"
            style={status === "loading" ? { position: "absolute", inset: 0, height: "100%", opacity: 0 } : undefined}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("failed")}
          />
        </>
      )}
    </div>
  );
}
