import { useId } from "react";
import type { Feature } from "@/lib/contracts";

export function ToolArt({ feature }: { feature: Feature }) {
  const id = useId().replaceAll(":", "");
  const colors = {
    email: ["#d9bcff", "#7653d8"],
    meetings: ["#a0f7ef", "#198ca6"],
    planner: ["#ffe2aa", "#bb772b"],
    research: ["#b6d9ff", "#4a70d5"],
    checkpoint: ["#b6f7da", "#2a9e89"],
  }[feature];
  return (
    <svg
      viewBox="0 0 160 120"
      className="tool-art"
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient
          id={id}
          x1="42"
          y1="20"
          x2="113"
          y2="106"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="50" y1="20" x2="120" y2="100">
          <stop stopColor="white" stopOpacity=".5" />
          <stop offset="1" stopColor="white" stopOpacity=".05" />
        </linearGradient>
      </defs>
      <ellipse cx="82" cy="106" rx="49" ry="7" fill={colors[1]} opacity=".16" />
      {feature === "email" && (
        <g transform="rotate(-9 80 65)">
          <path
            d="m28 49 50-26 53 26v44l-54 19-49-25Z"
            fill={`url(#${id})`}
            stroke={colors[0]}
          />
          <path
            d="m46 63 1-38 63-8v49L78 84Z"
            fill={`url(#${id}g)`}
            stroke="#e7dcff"
          />
          <path
            d="m59 35 37-5M59 45l28-4"
            stroke="white"
            strokeOpacity=".65"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="m28 49 50 35 53-35M28 87l35-15m68 21-37-19"
            stroke={colors[0]}
            strokeWidth="1.5"
          />
        </g>
      )}
      {feature === "meetings" && (
        <g>
          <path
            d="M70 24q0-11 12-11t12 11v41q0 13-12 13T70 65Z"
            fill={`url(#${id})`}
            stroke={colors[0]}
          />
          <path
            d="M61 51v13a21 21 0 0 0 42 0V51M82 86v16m-17 0h34"
            stroke={colors[0]}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M78 27h9m-9 8h9m-9 8h9"
            stroke="#fff"
            strokeOpacity=".5"
            strokeWidth="2"
          />
          <path
            d="M28 51v13m8-24v36m8-27v20m76-29v36m8-24v13m8-18v23"
            stroke={`url(#${id})`}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      )}
      {feature === "planner" && (
        <g transform="rotate(-8 80 65)">
          <path
            d="m38 26 84-6v81l-84 5Z"
            fill={`url(#${id})`}
            stroke={colors[0]}
          />
          <path
            d="m39 45 82-5M56 15v21m48-24v21"
            stroke={colors[0]}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="m53 60 5 4 9-11m-14 24 5 4 9-11"
            stroke="#fff4d8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m78 58 26-2M78 76l26-2m-51 20 50-3"
            stroke="#fff4d8"
            strokeOpacity=".6"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )}
      {feature === "research" && (
        <g>
          <path
            d="m35 22 63-8 15 17v67l-78 9Z"
            fill={`url(#${id})`}
            stroke={colors[0]}
          />
          <path
            d="m97 15-1 21 17-5M48 40l33-4M48 52l39-4m-39 16 22-2m-22 14 22-2"
            stroke={colors[0]}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx="104"
            cy="69"
            r="22"
            fill="#162b59"
            fillOpacity=".6"
            stroke="#b6e4ff"
            strokeWidth="5"
          />
          <path
            d="m120 85 18 18"
            stroke={`url(#${id})`}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M93 64q3-9 13-9"
            stroke="#e2f4ff"
            strokeOpacity=".6"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )}
      {feature === "checkpoint" && (
        <g>
          <path
            d="m80 13 46 26v52l-46 26-46-26V39Z"
            fill={`url(#${id})`}
            fillOpacity=".35"
            stroke={colors[0]}
            strokeWidth="1.5"
          />
          <path
            d="m34 39 46 26 46-26M80 65v52"
            stroke={colors[0]}
            strokeOpacity=".8"
            strokeWidth="1.5"
          />
          <path d="m80 28 31 18-31 18-31-18Z" fill={`url(#${id}g)`} />
          <path
            d="m62 73 13 13 25-31"
            stroke="#c2ffe5"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  );
}
