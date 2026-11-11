import { useState, type FormEvent } from "react";
import { normalizeRoomCode } from "../setup";
import { Avatar } from "./Avatar";
import { Button } from "./Button";

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
                    <span className="live-dot" /> A LITTLE FRIENDLY COMPETITION
                </div>
                <h1 id="hero-title">
                    <span className="hero-line hero-line-first">
                        Big brains.
                    </span>
                    <br />
                    <span className="hero-line hero-line-second">
                        Bigger vibes.
                    </span>
                </h1>
                <p className="hero-description">
                    Good questions bring people together. Make a quiz, gather
                    your favorite minds, and see where curiosity takes you.
                </p>
                <div className="home-community">
                    <div className="community-faces" aria-hidden="true">
                        {["memoji-21", "memoji-42", "memoji-58"].map(
                            (avatar) => (
                                <span key={avatar}>
                                    <Avatar value={avatar} decorative />
                                </span>
                            ),
                        )}
                    </div>
                    <div>
                        <strong>Better with your people.</strong>
                        <span>
                            Classmates, coworkers, or your favorite
                            know-it-alls.
                        </span>
                    </div>
                </div>
                <div className="hero-perks">
                    <span>
                        <Check /> Free to play
                    </span>
                    <span>
                        <Check /> No sign-up to join
                    </span>
                    <span>
                        <Check /> Just good times
                    </span>
                </div>
                <div className="hero-margin-note" aria-hidden="true">
                    <span>✳</span> A good time. A great guess.
                </div>
            </section>

            <section className="play-actions" aria-label="Start playing">
                <div className="start-card-heading">
                    <div className="start-card-icon" aria-hidden="true">
                        <Spark />
                    </div>
                    <span className="eyebrow">
                        YOUR NEXT GREAT GUESS STARTS HERE
                    </span>
                    <h2>
                        Let’s make
                        <br />a little <em>quizstory.</em>
                    </h2>
                    <p>One room. Your people. Plenty to talk about.</p>
                </div>
                <Button
                    className="host-action home-entry"
                    fullWidth
                    onClick={() => go("/create")}
                >
                    Create a room <Arrow />
                </Button>
                <p className="host-action-note">
                    Pick ready-made trivia or write your own.
                </p>
                <form
                    className="join-flow home-entry"
                    aria-label="Join your friends"
                    onSubmit={joinRoom}
                >
                    <label className="join-label" htmlFor="home-room-code">
                        Already have an invite?
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
                        <Button
                            className="join-action"
                            type="submit"
                            aria-label="Join a room"
                            disabled={code.length !== 6}
                        >
                            Join <Arrow />
                        </Button>
                    </div>
                </form>
                <div className="solo-action-row home-entry">
                    <span>Just you and your curiosity?</span>
                    <Button
                        intent="ghost"
                        className="solo-action"
                        onClick={() => go("/solo")}
                    >
                        Play solo <span aria-hidden="true">↗</span>
                    </Button>
                </div>
                <div className="start-card-footer">
                    <span aria-hidden="true">◎</span> No downloads. Just show up
                    and play.
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

function Check() {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
                d="m3.5 8 3 3 6-6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function Spark() {
    return (
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
                d="M24 2v44M2 24h44M8.4 8.4l31.2 31.2m0-31.2L8.4 39.6"
                stroke="currentColor"
                strokeWidth="5"
            />
        </svg>
    );
}
