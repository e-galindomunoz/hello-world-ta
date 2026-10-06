"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { setVote } from "@/app/feed/vote-actions";
import type { OwnVotes, VoteValue } from "@/lib/supabase/votes";
import styles from "./feed-vote-controls.module.css";

export function FeedVoteControls({ generationId, initialVote, status, retryHref }: {
  generationId: string;
  initialVote: VoteValue;
  status: OwnVotes["status"];
  retryHref: string;
}) {
  const [vote, setConfirmedVote] = useState(initialVote);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [signIn, setSignIn] = useState(false);
  const [needsReload, setNeedsReload] = useState(status === "error");
  const [error, setError] = useState(status === "error" ? "Your vote couldn’t load. Reload before voting." : "");
  const [message, setMessage] = useState("");
  const descriptionId = useId();

  function choose(value: 1 | -1) {
    if (submitting.current || needsReload) return;
    if (status === "anonymous") {
      setSignIn(true);
      return;
    }
    const desiredValue = vote === value ? null : value;
    submitting.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await setVote(generationId, desiredValue);
        if (result.ok) {
          setConfirmedVote(result.value);
          setMessage(result.value === null ? "Vote removed." : result.value === 1 ? "Upvote saved." : "Downvote saved.");
        } else {
          setError(result.message);
          setNeedsReload(true);
          if (result.code === "auth") setSignIn(true);
        }
      } catch {
        setError("Saving could not be confirmed. Reload your vote before trying again.");
        setNeedsReload(true);
      } finally {
        submitting.current = false;
      }
    });
  }

  return <div className={styles.voting}>
    <div className={styles.controls} role="group" aria-label="Vote on this post" aria-describedby={descriptionId} aria-busy={pending}>
      {([1, -1] as const).map((value) => <button key={value} type="button"
        className={styles.voteButton} disabled={pending || needsReload}
        aria-pressed={status === "error" ? undefined : vote === value}
        onClick={() => choose(value)}>
        <span aria-hidden="true">{value === 1 ? "↑" : "↓"}</span>
        {value === 1 ? "Upvote" : "Downvote"}
        {vote === value && <span className={styles.selected}>✓ Selected</span>}
      </button>)}
    </div>
    <p id={descriptionId} className={styles.help}>Select again to remove your vote.</p>
    <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>{pending ? "Saving vote…" : error ? "" : message}</p>
    {error && <p role="alert">{error}</p>}
    {needsReload && <a className={styles.retry} href={retryHref}>Reload your vote</a>}
    {signIn && <p role="status"><Link className={styles.signIn} href="/login">Sign in to vote</Link></p>}
  </div>;
}
