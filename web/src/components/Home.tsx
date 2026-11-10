import { useState, type FormEvent } from "react";
import { normalizeRoomCode } from "../setup";

export function Home({ go }: { go: (path: string) => void }) {
    const [code, setCode] = useState("");

    function joinRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (code.length === 6) go("/join?code=" + code);
    }

    return (
        <div className="home">
            <section className="landing-hero" aria-labelledby="hero-title">
                <div className="hero-kicker">
                    <span className="live-dot" /> GOOD QUESTIONS. GREAT COMPANY.
                </div>
                <h1 id="hero-title">
                    <span className="hero-line hero-line-first">
                        BIG BRAINS.
                        <span className="hero-mascot" aria-hidden="true">
                            <StarMascot />
                            <span>your brain, but on a good day</span>
                        </span>
                    </span>
                    <br />
                    <span className="hero-highlight hero-line hero-line-second">
                        BIGGER VIBES.
                    </span>
                </h1>
                <div className="hero-perks">
                    <span>
                        <Spark /> Free to play
                    </span>
                    <span>
                        <Spark /> No sign-up
                    </span>
                    <span>
                        <Spark /> Just good times
                    </span>
                </div>
                <Spark className="hero-spark" />
            </section>

            <section className="play-actions" aria-label="Start playing">
                <div className="hero-sticker" aria-hidden="true">
                    <span>LESS SCROLL.</span>
                    <strong>MORE PLAY.</strong>
                    <svg viewBox="0 0 100 60" fill="none">
                        <path d="M18 6c34-2 59 12 55 42M61 36l12 14 13-12" />
                    </svg>
                </div>
                <button
                    className="host-action home-entry"
                    onClick={() => go("/create")}
                >
                    Create a room
                    <span className="host-action-arrow">
                        <Arrow />
                    </span>
                </button>
                <form
                    className="join-flow home-entry"
                    aria-label="Join your friends"
                    onSubmit={joinRoom}
                >
                    <label className="join-label" htmlFor="home-room-code">
                        Have a room code?
                    </label>
                    <div className="join-controls">
                        <input
                            id="home-room-code"
                            className="home-code-input"
                            aria-label="Room code"
                            value={code}
                            onChange={(event) =>
                                setCode(normalizeRoomCode(event.target.value))
                            }
                            placeholder="ABC123"
                            required
                            minLength={6}
                            pattern="[A-Z0-9]{6}"
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            enterKeyHint="go"
                        />
                        <button
                            className="join-action"
                            type="submit"
                            aria-label="Join a room"
                            disabled={code.length !== 6}
                        >
                            Join <Arrow />
                        </button>
                    </div>
                </form>
                <div className="solo-action-row home-entry">
                    <span>Just you and your curiosity?</span>
                    <button className="solo-action" onClick={() => go("/solo")}>
                        Play solo <span aria-hidden="true">↗</span>
                    </button>
                </div>
            </section>
        </div>
    );
}

function Arrow() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
    );
}

function Spark({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
            <path
                d="m20 1 5.2 13.8L39 20l-13.8 5.2L20 39l-5.2-13.8L1 20l13.8-5.2Z"
                fill="currentColor"
            />
        </svg>
    );
}

function StarMascot() {
    return (
        <svg viewBox="0 0 190 190" fill="none">
            <path
                d="m97 13 20 37 42-7-8 43 28 30-42 11-12 42-30-29-43 9 7-42-37-20 38-20Z"
                fill="#ff8eb5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
            />
            <ellipse
                cx="84"
                cy="86"
                rx="4"
                ry="9"
                fill="currentColor"
                transform="rotate(-14 84 86)"
            />
            <ellipse
                cx="111"
                cy="80"
                rx="4"
                ry="9"
                fill="currentColor"
                transform="rotate(-14 111 80)"
            />
            <path
                d="M83 108q18 20 35-6M57 132l-13 22-14-3m95-16 14 20 16-6M22 39l-8-10m19 3-1-13m-9 38-13-2"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
        </svg>
    );
}
