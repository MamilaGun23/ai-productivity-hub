import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-wrap">
      <h1>This page took a wrong turn.</h1>
      <p>Find your way back to your workspace.</p>
      <Link className="button primary" href="/">
        Back to overview
      </Link>
    </div>
  );
}
