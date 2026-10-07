"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { checkGenerationAvailability, generateCaption } from "@/app/dashboard/generation-actions";
import { submitCreatorFeedback, type FeedbackRating } from "@/app/dashboard/feedback-actions";
import type { DailyGenerationStatus } from "@/lib/supabase/generation-limit";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_UPLOAD_ACCEPT, ImageUploadError, prepareImageUpload } from "@/lib/image-upload";
import { BrandMark, Icon } from "@/components/icons";
import styles from "./generation-image-upload.module.css";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function GenerationImageUpload({ initialDailyStatus }: { initialDailyStatus: DailyGenerationStatus }) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const generating = useRef(false);
  const checking = useRef(false);
  const preparation = useRef(0);
  const preparingRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => () => { preparation.current++; }, []);
  const [dailyStatus, setDailyStatus] = useState(initialDailyStatus);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [selection, setSelection] = useState<{ file: File; preview: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [generationPending, startGeneration] = useTransition();
  const [generation, setGeneration] = useState<{ id: string; caption: string } | null>(null);
  const feedbackSubmitting = useRef(false);
  const [confirmedRating, setConfirmedRating] = useState<FeedbackRating>(null);
  const [feedbackNeedsReload, setFeedbackNeedsReload] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackPending, startFeedback] = useTransition();

  const busy = preparing || pending || generationPending;
  const available = dailyStatus.state === "ready" && !dailyStatus.used;
  const resetLabel = dailyStatus.state === "ready" ? new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(dailyStatus.resetsAt)) : null;

  async function checkAvailability() {
    if (checking.current || generating.current) return;
    checking.current = true;
    setCheckingStatus(true);
    try {
      setDailyStatus(await checkGenerationAvailability());
    } catch {
      setDailyStatus({ state: "unknown" });
    } finally {
      checking.current = false;
      setCheckingStatus(false);
    }
  }

  useEffect(() => {
    const preview = selection?.preview;
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [selection]);

  async function choose(file: File) {
    if (uploading.current || generating.current) return;
    const request = ++preparation.current;
    preparingRef.current = true;
    setPreparing(true);
    setError("");
    setUploadedPath(null);
    setSelection(null);
    setGeneration(null);
    try {
      const prepared = await prepareImageUpload(file);
      if (request !== preparation.current) return;
      setSelection({ file: prepared, preview: URL.createObjectURL(prepared) });
    } catch (cause) {
      if (request === preparation.current) setError(cause instanceof ImageUploadError ? cause.message : "Couldn’t prepare this photo. Please try again.");
    } finally {
      if (request === preparation.current) {
        preparingRef.current = false;
        setPreparing(false);
      }
    }
  }

  async function upload() {
    if (preparingRef.current || !selection || uploading.current || generating.current || uploadedPath) return;
    uploading.current = true;
    setPending(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError("You gotta clock in before you start posting. Sign in again.");
        return;
      }
      const path = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[selection.file.type]}`;
      const { data, error: uploadError } = await supabase.storage
        .from("generation-images")
        .upload(path, selection.file, { contentType: selection.file.type, upsert: false });
      if (uploadError || !data) {
        setError("Couldn't upload the photo. Your selection is still here — try again.");
        return;
      }
      setUploadedPath(data.path);
    } catch {
      setError("Couldn't upload. Check your connection and try again.");
    } finally {
      uploading.current = false;
      setPending(false);
    }
  }

  function generate() {
    if (preparingRef.current || !uploadedPath || uploading.current || generating.current || checking.current || !available) return;
    generating.current = true;
    setError("");
    startGeneration(async () => {
      try {
        const result = await generateCaption(uploadedPath);
        if (result.dailyStatus) setDailyStatus(result.dailyStatus);
        if (result.ok) setGeneration(result.generation);
        else setError(result.message);
      } catch {
        setDailyStatus({ state: "unknown" });
        setError("The request was interrupted and saving could not be confirmed. Check availability before trying again. Your photo is still uploaded.");
      } finally {
        generating.current = false;
      }
    });
  }

  function submitFeedback(value: 1 | -1) {
    if (!generation || feedbackSubmitting.current || feedbackNeedsReload) return;
    const generationId = generation.id;
    const desiredRating: FeedbackRating = confirmedRating === value ? null : value;
    feedbackSubmitting.current = true;
    setFeedbackError("");
    setFeedbackMessage("");
    startFeedback(async () => {
      try {
        const result = await submitCreatorFeedback(generationId, desiredRating);
        if (result.ok) {
          setConfirmedRating(result.rating);
          setFeedbackMessage(
            result.rating === null ? "Feedback cleared." :
            result.rating === 1 ? "Noted — it nailed it." : "Got it — not your vibe.",
          );
        } else {
          setFeedbackError(result.message);
          if (result.code === "uncertain") setFeedbackNeedsReload(true);
        }
      } catch {
        setFeedbackError("Saving could not be confirmed. Reload before trying again.");
        setFeedbackNeedsReload(true);
      } finally {
        feedbackSubmitting.current = false;
      }
    });
  }

  const exhausted = dailyStatus.state === "ready" && dailyStatus.used && !generation && !generationPending;
  const scene = generation ? "result" : generationPending ? "generating" : exhausted ? "limit" : selection ? "preview" : "ready";

  return (
    <section className={styles.stage} data-scene={scene} aria-labelledby="generation-upload-heading">
      <header className={styles.heading}>
        <span className="eyebrow">{generation ? "Fresh out of the kitchen" : exhausted ? "See you tomorrow" : "Drop the evidence"}</span>
        <h1 id="generation-upload-heading">
          {generation ? "Aight so... this what we did. Thoughts?" : generationPending ? "Bet, let’s cook sum up frs." : exhausted ? "That’s enough foolishness for today." : "Aight, what do you have for us today?"}
        </h1>
        {!selection && !exhausted && <p>Something happened. We need the photo.</p>}
      </header>

      <div id="daily-generation-status" role="status" aria-live="polite" aria-atomic="true" className={styles.availability}>
        {checkingStatus ? <p>Checking availability…</p> : dailyStatus.state === "unknown" ? <p>Couldn’t check today’s availability. Check again before generating.</p> : exhausted ? (
          <p>Back for more <time dateTime={dailyStatus.resetsAt}>{resetLabel}</time>.</p>
        ) : null}
      </div>

      {exhausted ? (
        <div className={styles.limitScene}>
          <BrandMark />
          <p>The feed is still up to no good.</p>
          <Link className="button" href="/feed">Go see what happened <Icon name="arrow" /></Link>
          <button className={styles.textButton} disabled={checkingStatus} onClick={checkAvailability}>Check again</button>
        </div>
      ) : (
        <>
          <input ref={input} className="sr-only" type="file" accept={IMAGE_UPLOAD_ACCEPT}
            aria-label="Choose a photo" disabled={busy} tabIndex={-1}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) await choose(file);
            }} />

          {!selection ? (
            <button type="button" className={styles.uploadFrame} disabled={busy} onClick={() => input.current?.click()}>
              <span className={styles.brackets} aria-hidden="true"><i /><i /><i /><i /></span>
              <span className={styles.uploadIcon}><Icon name="upload" /></span>
              <strong>{preparing ? "Preparing your photo…" : "Drop a photo"}</strong>
              <span>Choose from your camera roll</span>
              <small>JPEG · PNG · WebP · HEIC/HEIF · up to 5 MiB after conversion</small>
            </button>
          ) : (
            <div className={styles.sceneBody}>
              <figure className={styles.preview}>
                <div className={styles.imageFrame}>
                  {/* Local blob previews stay local until the existing upload action. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selection.preview} alt={generation ? "Your published photo" : "Your selected photo"} />
                  {generationPending && <span className={styles.brackets} aria-hidden="true"><i /><i /><i /><i /></span>}
                </div>
                {!generation && !generationPending && <button type="button" className={styles.textButton} disabled={busy} onClick={() => input.current?.click()}>Choose a different photo</button>}
              </figure>

              {generation ? (
                <div className={styles.reveal}>
                  <span className={styles.published}><Icon name="check" /> Out in the wild</span>
                  <p className={styles.caption}>{generation.caption}</p>
                  <div className={styles.feedback}>
                    <span className={styles.privateLabel}><Icon name="lock" /> Just between us</span>
                    <h2>Did we get your humor right?</h2>
                    <div className={styles.feedbackChoices} role="group" aria-label="Private creator feedback" aria-busy={feedbackPending}>
                      {([1, -1] as const).map((value) => (
                        <button key={value} type="button" className={styles.feedbackChoice}
                          disabled={feedbackPending || feedbackNeedsReload}
                          aria-pressed={feedbackNeedsReload ? undefined : confirmedRating === value}
                          onClick={() => submitFeedback(value)}>
                          <span aria-hidden="true">{value === 1 ? "✦" : "∿"}</span>
                          {value === 1 ? "That’s so me" : "Not my humor"}
                        </button>
                      ))}
                    </div>
                    <p className={styles.note}>Private feedback. Tap your selection again to clear it.</p>
                    <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>{feedbackPending ? "Saving…" : feedbackMessage}</p>
                    {feedbackError && <p role="alert" className={styles.error}>{feedbackError}</p>}
                    {feedbackNeedsReload && <a className={styles.textButton} href="/dashboard">Reload</a>}
                  </div>
                  <Link className="button" href="/feed">See it in the feed <Icon name="arrow" /></Link>
                </div>
              ) : generationPending ? (
                <div className={styles.cooking}>
                  <BrandMark />
                  <p>Finding the words for… whatever this is.</p>
                  <span className={styles.cookingDots} aria-hidden="true"><i /><i /><i /></span>
                </div>
              ) : (
                <div className={styles.nextStep}>
                  <span className="eyebrow">{uploadedPath ? "Time for the caption" : "Yep. That’s the one."}</span>
                  <h2>{uploadedPath ? "Let’s make this everyone’s problem." : "This deserves an explanation."}</h2>
                  {uploadedPath ? (
                    <>
                      <p className={styles.disclosure}>Your photo goes to Google Gemini. When the caption saves, your photo and caption publish to the public feed.</p>
                      <button type="button" className="button" disabled={busy || checkingStatus || !available} aria-describedby="daily-generation-status" onClick={generate}><Icon name="spark" /> Caption &amp; post</button>
                    </>
                  ) : (
                    <>
                      <p>Upload this photo privately first. Then we’ll find its caption.</p>
                      <button type="button" className="button" disabled={busy} onClick={upload}>{pending ? <><span className="spinner" /> Uploading…</> : <><Icon name="upload" /> Upload this one</>}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {dailyStatus.state === "unknown" && !generation && <button type="button" className={styles.textButton} disabled={generationPending || checkingStatus} onClick={checkAvailability}>Check availability</button>}
        </>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
        {preparing ? "Preparing your photo… HEIC/HEIF images are converted to JPEG on your device." : pending ? "Uploading your photo…" : generationPending ? "Generating and publishing…" : generation ? "Post published to the feed." : uploadedPath ? "Photo uploaded privately." : ""}
      </p>
      <p role="alert" aria-atomic="true" className={styles.error}>{error}</p>
    </section>
  );
}
