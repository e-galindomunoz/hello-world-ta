import styles from "./feed.module.css";

export default function Loading() {
  return <div className={styles.state} role="status" aria-live="polite">
    <h2>Loading posts…</h2>
    <div className={styles.skeleton} aria-hidden="true" />
  </div>;
}
