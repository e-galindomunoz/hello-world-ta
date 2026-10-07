import styles from "./feed.module.css";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading the feed…</span>
      <div className={styles.posts} aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className={`${styles.post} ${styles.skeleton}`} />)}
      </div>
    </div>
  );
}
