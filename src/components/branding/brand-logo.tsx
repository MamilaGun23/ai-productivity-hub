import { useId } from "react";

/** Original folded pathway: two ascending ribbons connected by a glass bridge. */
export function RibbonMark({
  className = "",
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className={`ribbon-mark ${className}`}
      viewBox="0 0 128 128"
      fill="none"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "AI Productivity Hub"}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient
          id={`${id}a`}
          x1="18"
          y1="107"
          x2="88"
          y2="18"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#3144db" />
          <stop offset=".46" stopColor="#8475ff" />
          <stop offset="1" stopColor="#c3b7ff" />
        </linearGradient>
        <linearGradient
          id={`${id}b`}
          x1="65"
          y1="20"
          x2="111"
          y2="105"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4888ff" />
          <stop offset=".5" stopColor="#43d8f1" />
          <stop offset="1" stopColor="#2355b8" />
        </linearGradient>
        <linearGradient
          id={`${id}c`}
          x1="36"
          y1="70"
          x2="104"
          y2="91"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#bba5ff" />
          <stop offset=".5" stopColor="#7159df" />
          <stop offset="1" stopColor="#30399a" />
        </linearGradient>
      </defs>
      <path
        d="M16 101 53 24Q60 10 73 20L87 30 49 111Q45 119 36 114Z"
        fill={`url(#${id}a)`}
      />
      <path
        d="m65 19 20 10 29 73q3 8-6 12l-17 5-31-79Z"
        fill={`url(#${id}b)`}
      />
      <path d="m40 70 46-9 12 28-46 12-20-11Z" fill={`url(#${id}c)`} />
      <path
        d="m18 100 37-76q6-11 15-5M66 21l18 10 28 71M42 71l43-8"
        stroke="white"
        strokeOpacity=".62"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="m32 90 20 11 46-12-9 17-40 9Z" fill="#22265c" opacity=".35" />
    </svg>
  );
}
export function BrandLogo({
  compact = false,
  variant = "dark",
}: {
  compact?: boolean;
  variant?: "light" | "dark";
}) {
  return (
    <span className={`brand-logo brand-${variant}`}>
      <RibbonMark decorative />
      {!compact && (
        <span className="brand-wordmark">
          AI Productivity
          <span>
            HUB
            <span className="brand-wordmark-line" />
          </span>
        </span>
      )}
    </span>
  );
}
