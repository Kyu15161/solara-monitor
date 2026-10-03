export default function Loading() {
  return (
    <main className="loading-page" aria-busy="true">
      <div className="brand">
        ☀ solara<span>MONITOR</span>
      </div>
      <div className="skeleton" aria-hidden="true" />
      <p role="status">Loading your energy data…</p>
    </main>
  );
}
