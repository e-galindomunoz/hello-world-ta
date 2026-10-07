export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="loading-state">
      <span className="spinner" aria-hidden="true" />
      One sec…
    </div>
  );
}
