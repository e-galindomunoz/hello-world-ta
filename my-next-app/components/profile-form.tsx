"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveProfile } from "@/app/dashboard/profile-actions";
import { Icon } from "@/components/icons";

type Profile = { first_name: string | null; last_name: string | null; avatar_url: string | null; humor_preference: string | null };

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [humorPreference, setHumorPreference] = useState(profile.humor_preference ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const dirty = firstName !== (profile.first_name ?? "") || lastName !== (profile.last_name ?? "")
    || humorPreference !== (profile.humor_preference ?? "") || photo !== null;
  const [, formAction, pending] = useActionState(async (_state: null, data: FormData) => {
    // Keep the selected image available for a retry if the form resets after an error.
    if (photo) data.set("avatar", photo);
    setFeedback(null);
    try {
      const result = await saveProfile({ message: "" }, data);
      const success = result.message === "Profile saved.";
      setFeedback({ message: result.message, error: !success });
      if (success) {
        setFirstName(String(data.get("first_name")).trim());
        setLastName(String(data.get("last_name")).trim());
        setHumorPreference(String(data.get("humor_preference")).trim());
        setPhoto(null);
        setPreview(null);
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch {
      setFeedback({ message: "We couldn’t save your changes. Please try again.", error: true });
    }
    return null;
  }, null);

  function discard() {
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setHumorPreference(profile.humor_preference ?? "");
    setPhoto(null);
    setPreview(null);
    setFeedback(null);
    if (fileInput.current) { fileInput.current.value = ""; fileInput.current.setCustomValidity(""); }
  }

  const avatar = preview ?? profile.avatar_url;
  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}` || email[0]?.toUpperCase() || "?";
  return <form action={formAction} className="profile-form" aria-busy={pending}>
    <div className="profile-body">
      <div className="avatar-column"><div className="avatar-ring">{avatar ? (
        // Public Storage URLs and local previews are rendered directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="profile-photo" src={avatar} alt="Your profile photo" width={144} height={144} />
      ) : <div className="profile-photo avatar-placeholder">{initials}</div>}<span className="avatar-status"><Icon name="check" /></span></div>
        <h3>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your next great introduction"}</h3><span className="muted small-text">Your profile photo</span>
        <button className="button secondary upload-button" type="button" disabled={pending} onClick={() => fileInput.current?.click()}><Icon name="upload" /> Change photo</button>
        <input className="sr-only" ref={fileInput} id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" aria-describedby="photo-help" disabled={pending} onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
            setFeedback({ message: "Choose a JPEG, PNG, or WebP image no larger than 5 MB.", error: true });
            event.target.value = "";
            return;
          }
          setPhoto(file); setPreview(URL.createObjectURL(file)); setFeedback(null);
        }} />
        <p id="photo-help">JPG, PNG or WebP<br />Up to 5 MB</p>{photo && <span className="selected-file">Selected: {photo.name}</span>}
      </div>
      <div className="profile-fields"><div className="section-heading"><h2>Personal information</h2><p>The details that make this space yours.</p></div>
        <div className="field"><label htmlFor="profile-email">Email address <span className="readonly-badge"><Icon name="lock" /> Read only</span></label><div className="readonly-input"><input id="profile-email" type="email" value={email} readOnly aria-describedby="email-help" /><Icon name="lock" /></div><p id="email-help" className="field-help">Connected to your Google account. Your email can’t be edited here.</p></div>
        <div className="name-fields"><div className="field"><label htmlFor="first-name">First name</label><input id="first-name" name="first_name" autoComplete="given-name" required value={firstName} placeholder="Your first name" onChange={(event) => { setFirstName(event.target.value); setFeedback(null); }} disabled={pending} /></div><div className="field"><label htmlFor="last-name">Last name</label><input id="last-name" name="last_name" autoComplete="family-name" required value={lastName} placeholder="Your last name" onChange={(event) => { setLastName(event.target.value); setFeedback(null); }} disabled={pending} /></div></div>
        <div className="field">
          <label htmlFor="humor-preference">What makes you laugh? <span className="muted">(optional)</span></label>
          <textarea id="humor-preference" name="humor_preference" rows={4} maxLength={500}
            value={humorPreference} disabled={pending} aria-describedby="humor-help humor-length"
            placeholder="Dry jokes, absurdity, bread falling…"
            onChange={(event) => { setHumorPreference(event.target.value); setFeedback(null); }} />
          <p id="humor-help" className="field-help">Sent to Google Gemini when generating captions. Leave blank for the default style. Avoid including sensitive information.</p>
          <p id="humor-length" className="field-help">{humorPreference.length} / 500 characters</p>
        </div>
        <div className="profile-tip"><span className="tip-icon"><Icon name="spark" /></span><div><strong>A little more you.</strong><p>A familiar name and photo make your space feel like home.</p></div></div>
      </div>
    </div>
    <div className="profile-footer"><div className={`save-status ${feedback?.error ? "error-text" : feedback ? "success-text" : ""}`} role="status" aria-live="polite">{pending ? <><span className="spinner" /> Saving your changes…</> : feedback ? <>{!feedback.error && <Icon name="check" />}{feedback.message}</> : dirty ? <><span className="unsaved-dot" /> You have unsaved changes</> : <><Icon name="lock" /> Changes are saved only when you choose.</>}</div><div className="actions"><button type="button" className="button secondary" onClick={discard} disabled={pending || !dirty}>Discard</button><button className="button" type="submit" disabled={pending || !dirty || !firstName.trim() || !lastName.trim()}>{pending ? "Saving…" : "Save Changes"}{!pending && <Icon name="arrow" />}</button></div></div>
  </form>;
}
