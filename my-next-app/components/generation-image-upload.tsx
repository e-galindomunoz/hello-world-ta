"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { generateCaption } from "@/app/dashboard/generation-actions";
import { createClient } from "@/lib/supabase/client";
import styles from "./generation-image-upload.module.css";

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function GenerationImageUpload() {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const generating = useRef(false);
  const [selection, setSelection] = useState<{ file: File; preview: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [generationPending, startGeneration] = useTransition();
  const [generation, setGeneration] = useState<{ id: string; caption: string } | null>(null);
  const busy = pending || generationPending;

  useEffect(() => {
    const preview = selection?.preview;
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [selection]);

  function choose(file: File) {
    if (uploading.current || generating.current) return;
    setError("");
    setUploadedPath(null);
    setSelection(null);
    setGeneration(null);
    if (!Object.hasOwn(EXTENSIONS, file.type)) {
      setError("Choose a JPEG, PNG, or WebP photo. HEIC and other formats are not supported yet.");
      return;
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError("Choose a nonempty image no larger than 5 MiB.");
      return;
    }
    setSelection({ file, preview: URL.createObjectURL(file) });
  }

  async function upload() {
    if (!selection || uploading.current || generating.current || uploadedPath) return;
    uploading.current = true;
    setPending(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError("Your session has expired. Sign in again before uploading.");
        return;
      }

      // Storage RLS independently enforces this session-derived folder.
      const path = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[selection.file.type]}`;
      const { data, error: uploadError } = await supabase.storage
        .from("generation-images")
        .upload(path, selection.file, {
          contentType: selection.file.type,
          upsert: false,
        });

      if (uploadError || !data) {
        setError("Unable to upload your photo. Your selection is still available; please try again.");
        return;
      }
      // Send only this path to the Server Action; it validates ownership again.
      setUploadedPath(data.path);
    } catch {
      setError("Unable to upload your photo. Check your connection and try again.");
    } finally {
      uploading.current = false;
      setPending(false);
    }
  }

  function generate() {
    if (!uploadedPath || uploading.current || generating.current || generation) return;
    generating.current = true;
    setError("");
    startGeneration(async () => {
      try {
        const result = await generateCaption(uploadedPath);
        if (result.ok) setGeneration(result.generation);
        else setError(result.message);
      } catch {
        setError("The request was interrupted and saving could not be confirmed. Retrying may create another caption. Your photo is still uploaded.");
      } finally {
        generating.current = false;
      }
    });
  }

  return (
    <section className={styles.card} aria-labelledby="generation-upload-heading">
      <h2 id="generation-upload-heading">Upload a photo</h2>
      <p>Your photo stays private. Choose a photo from your library or take one with your phone.</p>
      <p id="generation-upload-help" className={styles.help}>JPEG, PNG, or WebP · Up to 5 MiB · One photo at a time</p>

      <input
        ref={input}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        aria-label="Choose a photo"
        aria-describedby="generation-upload-help"
        disabled={busy}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) choose(file);
        }}
      />

      <button
        type="button"
        className={styles.chooseButton}
        disabled={busy}
        aria-describedby="generation-upload-help"
        onClick={() => input.current?.click()}
      >
        {selection ? "Choose another photo" : "Choose photo"}
      </button>

      {selection && (
        <figure className={styles.preview}>
          {/* Local blob previews do not need Next.js image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selection.preview} alt="Selected photo preview" />
          <figcaption>{selection.file.name}</figcaption>
        </figure>
      )}

      <button
        type="button"
        className={styles.uploadButton}
        disabled={!selection || busy || Boolean(uploadedPath)}
        onClick={upload}
      >
        {pending ? "Uploading…" : uploadedPath ? "Uploaded" : "Upload photo"}
      </button>
      {uploadedPath && (
        <div className={styles.generation}>
          <p id="generation-help">Generate a funny caption. Your photo will be sent to Google Gemini, and the caption will be saved.</p>
          <button
            type="button"
            className={styles.uploadButton}
            disabled={busy || Boolean(generation)}
            aria-describedby="generation-help"
            onClick={generate}
          >
            {generationPending ? "Generating caption…" : generation ? "Caption saved" : "Generate caption"}
          </button>
        </div>
      )}
      {generation && (
        <div className={styles.caption} aria-labelledby="saved-caption-heading">
          <h3 id="saved-caption-heading">Your caption</h3>
          <p>{generation.caption}</p>
        </div>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
        {pending ? "Uploading your photo…" : generationPending ? "Generating and saving your caption…" : generation ? "Caption saved." : uploadedPath ? "Photo uploaded privately." : ""}
      </p>
      <p role="alert" aria-atomic="true" className={styles.error}>{error}</p>
    </section>
  );
}
