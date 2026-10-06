import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { FeedPostImage } from "@/components/feed-post-image";
import { FeedVoteControls } from "@/components/feed-vote-controls";
import { loadOwnVotes } from "@/lib/supabase/votes";
import styles from "./feed.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Public feed — LetsBeGoofy" };
const PAGE_SIZE = 12;
type Post = { id: string; caption: string; created_at: string };

async function loadPosts(page: number): Promise<Post[] | null> {
  try {
    const start = (page - 1) * PAGE_SIZE;
    const { data, error } = await createPublicClient().from("generations")
      .select("id, caption, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + PAGE_SIZE);
    return error ? null : data;
  } catch {
    return null;
  }
}

export default async function Feed({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { page: value } = await searchParams;
  if (value !== undefined && (typeof value !== "string" || !/^[1-9][0-9]{0,5}$/.test(value))) redirect("/feed");
  const page = value === undefined ? 1 : Number(value);
  const posts = await loadPosts(page);
  if (posts === null) return <section className={styles.state} role="alert">
    <h2>The feed couldn’t load</h2>
    <p>Please try again in a moment.</p>
    <a className="button secondary" href={page === 1 ? "/feed" : `/feed?page=${page}`}>Try again</a>
  </section>;

  const hasNext = posts.length > PAGE_SIZE;
  const visiblePosts = posts.slice(0, PAGE_SIZE);
  const ownVotes = await loadOwnVotes(visiblePosts.map((post) => post.id));
  const retryHref = page === 1 ? "/feed" : `/feed?page=${page}`;
  return <>
    {posts.length === 0 ? <section className={styles.state}>
      <h2>{page === 1 ? "The first laugh is yours" : "No posts on this page"}</h2>
      <p>{page === 1 ? "Create a post to get the feed started." : "Head back to the latest posts."}</p>
      <Link className="button secondary" href={page === 1 ? "/dashboard" : "/feed"}>{page === 1 ? "Create a post" : "Latest posts"}</Link>
    </section> : <div className={styles.posts}>
      {visiblePosts.map((post) => <article key={post.id} id={`post-${post.id}`} className={styles.post} aria-label="Published post">
        <FeedPostImage generationId={post.id} />
        <div className={styles.postBody}>
          <p className={styles.caption}>{post.caption}</p>
          <time dateTime={post.created_at}>{new Intl.DateTimeFormat("en", {
            dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
          }).format(new Date(post.created_at))} UTC</time>
          <FeedVoteControls
            key={`${post.id}:${ownVotes.status}:${ownVotes.status === "ready" ? ownVotes.votes[post.id] ?? "none" : "unknown"}`}
            generationId={post.id}
            initialVote={ownVotes.status === "ready" ? ownVotes.votes[post.id] ?? null : null}
            status={ownVotes.status}
            retryHref={`${retryHref}#post-${post.id}`}
          />
        </div>
      </article>)}
    </div>}
    {(page > 1 || hasNext) && <nav className={styles.pagination} aria-label="Feed pages">
      {page > 1 && <Link className="button secondary" href={page === 2 ? "/feed" : `/feed?page=${page - 1}`}>Newer posts</Link>}
      <span>Page {page}</span>
      {hasNext && <Link className="button secondary" href={`/feed?page=${page + 1}`}>Older posts</Link>}
    </nav>}
  </>;
}
