import type { Snapshot } from "../types";
import { Avatar } from "./Avatar";

export function Leaderboard({
    entries,
    currentPlayer,
    solo,
    hideHeading = false,
    code,
}: {
    entries: NonNullable<Snapshot["leaderboard"]>;
    currentPlayer: string;
    solo: boolean;
    hideHeading?: boolean;
    code: string;
}) {
    const winners = entries.slice(0, 3);
    const remaining = entries.slice(3);

    return (
        <div
            className={`leaderboard podium-board${remaining.length > 0 ? " has-standings" : ""}`}
        >
            <div className="leaderboard-stage">
                {!hideHeading && (
                    <div className="leaderboard-heading">
                        <div className="eyebrow">
                            {solo ? "A LITTLE WISER" : "THE WINNER'S CIRCLE"}
                        </div>
                        <h2>
                            {solo ? "Your result" : "The final leaderboard"}
                        </h2>
                        <p>
                            Room {code} <span aria-hidden="true">·</span>{" "}
                            {entries.length}{" "}
                            {entries.length === 1 ? "player" : "players"}
                        </p>
                    </div>
                )}
                {winners.length > 0 ? (
                    <ol className="winner-podium" aria-label="Top players">
                        {winners.map((entry, index) => (
                            <li
                                key={entry.id}
                                className={`podium-player podium-place-${index + 1}${entry.id === currentPlayer ? " me" : ""}`}
                                aria-label={`Rank ${entry.rank}: ${entry.name}${entry.id === currentPlayer ? ", you" : ""}, ${entry.score} points`}
                            >
                                <div className="podium-person">
                                    {index === 0 && (
                                        <svg
                                            className="winner-crown"
                                            width="30"
                                            height="25"
                                            viewBox="0 0 30 25"
                                            fill="none"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="m4 7 6 5 5-9 5 9 6-5-3 14H7L4 7Z"
                                                fill="#ffcf45"
                                                stroke="#8c651b"
                                                strokeWidth="1.3"
                                                strokeLinejoin="round"
                                            />
                                            <path
                                                d="M8 18h14"
                                                stroke="#8c651b"
                                                strokeWidth="1.3"
                                            />
                                        </svg>
                                    )}
                                    <span
                                        className="podium-avatar"
                                        aria-hidden="true"
                                    >
                                        <Avatar
                                            value={entry.avatar}
                                            decorative
                                        />
                                    </span>
                                    <strong className="podium-name">
                                        {entry.name}
                                    </strong>
                                    <span
                                        className={`podium-you${entry.id === currentPlayer ? " is-you" : ""}`}
                                    >
                                        {entry.id === currentPlayer
                                            ? "YOU"
                                            : `PLACE ${entry.rank}`}
                                    </span>
                                    <span className="podium-score">
                                        {entry.score.toLocaleString()}{" "}
                                        <small>pts</small>
                                    </span>
                                </div>
                                <div className="podium-step" aria-hidden="true">
                                    <span className="podium-stars">
                                        {index === 0 ? "✦ ✦ ✦" : "✦ ✦"}
                                    </span>
                                    <strong>{entry.rank}</strong>
                                    <svg
                                        className="podium-laurel"
                                        width="66"
                                        height="28"
                                        viewBox="0 0 66 28"
                                        fill="none"
                                    >
                                        <path
                                            d="M28 25C14 24 6 15 7 3M38 25C52 24 60 15 59 3"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        />
                                        <path
                                            d="m7 8-5-4m6 10-6-2m10 8-7-1m13 5-6 1M59 8l5-4m-6 10 6-2m-10 8 7-1m-13 5 6 1"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="leaderboard-empty">
                        No player scores for this round.
                    </p>
                )}
                <p className="leaderboard-final-note">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                    >
                        <circle cx="10" cy="10" r="7.5" />
                        <path d="m6 10 2.5 2.5L14 7" />
                    </svg>
                    All scores are final. Bragging rights are yours.
                </p>
            </div>
            {remaining.length > 0 && (
                <div className="leaderboard-standings">
                    <div className="standings-eyebrow eyebrow">
                        EVERY POINT COUNTS
                    </div>
                    <div className="leaderboard-list-heading">
                        <h3>The good company</h3>
                        <span>POINTS</span>
                    </div>
                    <ol
                        className="ranked-players"
                        start={4}
                        aria-label="Remaining players"
                        tabIndex={0}
                    >
                        {remaining.map((entry) => (
                            <li
                                key={entry.id}
                                className={
                                    entry.id === currentPlayer ? "me" : ""
                                }
                            >
                                <span
                                    className="list-rank"
                                    aria-label={`Rank ${entry.rank}`}
                                >
                                    {entry.rank}
                                </span>
                                <span
                                    className="list-avatar"
                                    aria-hidden="true"
                                >
                                    <Avatar value={entry.avatar} decorative />
                                </span>
                                <div className="list-player-name">
                                    <strong>{entry.name}</strong>
                                    <small>
                                        {entry.id === currentPlayer
                                            ? "That’s you. Nicely played."
                                            : "Good guesses. Great company."}
                                    </small>
                                </div>
                                {entry.id === currentPlayer && (
                                    <span className="list-you">YOU</span>
                                )}
                                <span className="list-score">
                                    {entry.score.toLocaleString()}
                                    <small>pts</small>
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}
