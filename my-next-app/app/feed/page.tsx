import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { FeedPostImage } from "@/components/feed-post-image";
import { FeedVoteControls } from "@/components/feed-vote-controls";
import { loadOwnVotes } from "@/lib/supabase/votes";
import styles from "./feed.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feed — LetsBeGoofy" };
const PAGE_SIZE = 12;
type Sort = "new" | "hot";
type Post = { id: string; caption: string; created_at: string; score: number };

function feedHref(sort: Sort, page = 1) {
  return `/feed?sort=${sort}${page > 1 ? `&page=${page}` : ""}`;
}

async function loadPosts(page: number, sort: Sort): Promise<Post[] | null> {
  try {
    const start = (page - 1) * PAGE_SIZE;
    const { data, error } = await createPublicClient()
      .rpc("get_public_feed", { p_sort: sort, p_limit: PAGE_SIZE + 1, p_offset: start })
      .select("id, caption, created_at, score");
    return error || !Array.isArray(data) ? null : data;
  } catch {
    return null;
  }
}

export default async function Feed({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { page: value, sort: requestedSort } = await searchParams;
  if (requestedSort !== undefined && requestedSort !== "new" && requestedSort !== "hot") redirect("/feed?sort=new");
  const sort: Sort = requestedSort ?? "new";
  if (value !== undefined && (typeof value !== "string" || !/^[1-9][0-9]{0,5}$/.test(value))) redirect(feedHref(sort));
  const page = value === undefined ? 1 : Number(value);
  const retryHref = feedHref(sort, page);

  const sorting = (
    <div className={styles.sorting}>
      <nav className={styles.sortControls} aria-label="Feed sorting">
        {(["new", "hot"] as const).map((mode) => (
          <Link key={mode} className={styles.sortLink} href={feedHref(mode)}
            aria-current={sort === mode ? "page" : undefined}>
            {mode === "new" ? "New" : "Hot"}
          </Link>
        ))}
      </nav>
      <p className={styles.sortDesc}>
        {sort === "new" ? "Just dropped." : "Getting a reaction."}
      </p>
    </div>
  );

  const posts = await loadPosts(page, sort);
  if (posts === null) return (
    <>
      {sorting}
      <section className={styles.state} role="alert">
        <h2>Yeahhh something broke.</h2>
        <p>Try that again.</p>
        <a className="button secondary" href={retryHref}>Try again</a>
      </section>
    </>
  );

  const hasNext = posts.length > PAGE_SIZE;
  const visiblePosts = posts.slice(0, PAGE_SIZE);
  const ownVotes = await loadOwnVotes(visiblePosts.map((post) => post.id));

  return (
    <>
      {sorting}
      {posts.length === 0 ? (
        <section className={styles.state}>
          <h2>{page === 1 ? "Damn. Nobody’s posted anything yet." : "Nothing on this page."}</h2>
          <p>{page === 1 ? "Be the first to drop some evidence." : "Head back to the first page."}</p>
          <Link className="button secondary" href={page === 1 ? "/dashboard" : feedHref(sort)}>
            {page === 1 ? "Create a post" : "First page"}
          </Link>
        </section>
      ) : (
        <div className={styles.posts}>
          {visiblePosts.map((post) => (
            <article key={post.id} id={`post-${post.id}`} className={styles.post} aria-label="Published post">
              <FeedPostImage generationId={post.id} />
              <div className={styles.postBody}>
                <p className={styles.caption}>{post.caption}</p>
                <FeedVoteControls
                  key={`${post.id}:${ownVotes.status}:${ownVotes.status === "ready" ? ownVotes.votes[post.id] ?? "none" : "unknown"}`}
                  score={post.score}
                  generationId={post.id}
                  initialVote={ownVotes.status === "ready" ? ownVotes.votes[post.id] ?? null : null}
                  status={ownVotes.status}
                  retryHref={`${retryHref}#post-${post.id}`}
                />
                <time className={styles.timestamp} dateTime={post.created_at} title={new Date(post.created_at).toUTCString()}>
                  {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(post.created_at))}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
      {(page > 1 || hasNext) && (
        <nav className={styles.pagination} aria-label="Feed pages">
          {page > 1 && <Link className="button secondary" href={feedHref(sort, page - 1)}>Previous</Link>}
          <span>Page {page}</span>
          {hasNext && <Link className="button secondary" href={feedHref(sort, page + 1)}>Next</Link>}
        </nav>
      )}
    </>
  );
}
