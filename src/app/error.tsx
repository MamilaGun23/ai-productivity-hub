"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-wrap">
      <h1>Something interrupted your workspace.</h1>
      <p>Try again. Previously saved history stays on this browser.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
