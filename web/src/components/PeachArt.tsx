import { useId } from "react";

export function PlayIcon({
    kind = "spark",
}: {
    kind?: "spark" | "group" | "play" | "arrow";
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {kind === "arrow" ? (
                <path d="M5 12h14m-6-6 6 6-6 6" />
            ) : kind === "play" ? (
                <path d="m8 5 11 7-11 7z" />
            ) : kind === "group" ? (
                <>
                    <circle cx="9" cy="8" r="3" />
                    <path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 9v-3a6 6 0 0 0-3-5" />
                </>
            ) : (
                <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
            )}
        </svg>
    );
}

export function PlaygroundTrophy() {
    const gold = useId();
    return (
        <svg
            className="playground-trophy"
            viewBox="0 0 180 180"
            fill="none"
            aria-hidden="true"
        >
            <defs>
                <linearGradient
                    id={gold}
                    x1="30"
                    y1="20"
                    x2="135"
                    y2="145"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#fff2a2" />
                    <stop offset=".35" stopColor="#ffce42" />
                    <stop offset="1" stopColor="#e98a06" />
                </linearGradient>
            </defs>
            <ellipse
                cx="90"
                cy="161"
                rx="48"
                ry="7"
                fill="#322515"
                opacity=".08"
            />
            <path
                d="M56 37H26v15c0 26 15 40 39 40m59-55h30v15c0 26-15 40-39 40"
                stroke="#eda714"
                strokeWidth="9"
            />
            <path
                d="M48 23h84l-8 54c-3 23-15 34-34 34S59 100 56 77z"
                fill={`url(#${gold})`}
            />
            <path d="M90 110v29m-27 6h54" stroke="#efa513" strokeWidth="14" />
            <rect x="56" y="143" width="68" height="15" rx="5" fill="#704724" />
            <path
                d="m90 44 6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z"
                fill="#fff8cd"
            />
            <path
                d="M59 31h64"
                stroke="#fff3ab"
                strokeWidth="5"
                strokeLinecap="round"
            />
        </svg>
    );
}
