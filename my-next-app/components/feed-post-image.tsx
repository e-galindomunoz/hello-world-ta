"use client";

import { useState } from "react";
import styles from "@/app/feed/feed.module.css";

export function FeedPostImage({ generationId }: { generationId: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className={styles.image}>
    {failed ? <div className={styles.imageFailure} role="status">
      <p>This photo couldn’t load.</p>
      <button className="button secondary" type="button" onClick={() => {
        setAttempt(attempt + 1);
        setFailed(false);
      }}>Retry photo</button>
    </div> : (
      // Fetch through the ID-only route when the image enters view, so signed
      // URLs do not expire while waiting offscreen. Retry requests a fresh URL.
      // eslint-disable-next-line @next/next/no-img-element
      <img key={attempt} src={`/feed/images/${encodeURIComponent(generationId)}?retry=${attempt}`}
        alt="Published photo for the caption below" loading="lazy" decoding="async"
        onError={() => setFailed(true)} />
    )}
  </div>;
}
