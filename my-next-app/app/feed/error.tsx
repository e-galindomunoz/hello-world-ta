"use client";

import styles from "./feed.module.css";

export default function FeedError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className={styles.state} role="alert">
      <h2>Yeahhh something broke.</h2>
      <p>Try that again.</p>
      <button type="button" className="button secondary" onClick={retry}>Try again</button>
    </section>
  );
}
