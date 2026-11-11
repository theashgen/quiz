import { useState, type FormEvent } from "react";
import { normalizeRoomCode } from "../setup";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { PlaygroundTrophy, PlayIcon } from "./PeachArt";

export function Home({ go }: { go: (path: string) => void }) {
    const [code, setCode] = useState("");

    function joinRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (code.length === 6) go("/join?code=" + code);
    }

    return (
        <div className="home peach-home">
            <section className="playground-hero" aria-labelledby="hero-title">
                <div className="playground-intro">
                    <div className="playground-kicker">
                        <span /> A LITTLE FRIENDLY COMPETITION
                    </div>
                    <h1 id="hero-title">
                        Play together.
                        <br />
                        <span>Grow curious.</span>
                    </h1>
                    <p>
                        Good questions. Great company. Turn what you know into
                        your next good time.
                    </p>
                    <div className="playground-community">
                        <div className="playground-faces" aria-hidden="true">
                            {["memoji-21", "memoji-42", "memoji-58"].map(
                                (value) => (
                                    <span key={value}>
                                        <Avatar value={value} decorative />
                                    </span>
                                ),
                            )}
                        </div>
                        <div>
                            <strong>Better with your people.</strong>
                            <span>No sign-up needed to join.</span>
                        </div>
                    </div>
                </div>
                <div className="playground-bento" aria-hidden="true">
                    <div className="playground-tile tile-blue">
                        <strong>
                            PLAY.
                            <br />
                            LEARN.
                            <br />
                            REPEAT.
                        </strong>
                        <Avatar value="memoji-21" decorative />
                    </div>
                    <div className="playground-tile tile-violet">
                        <strong>
                            Better
                            <br />
                            together.
                        </strong>
                        <Avatar value="memoji-42" decorative />
                        <span className="bento-question">?</span>
                    </div>
                    <div className="playground-tile tile-gold">
                        <strong>
                            Your next
                            <br />
                            big win.
                        </strong>
                        <PlaygroundTrophy />
                    </div>
                </div>
            </section>
            <section className="playground-modes" aria-label="Start playing">
                <div className="playground-mode mode-host">
                    <span className="playground-mode-icon">
                        <PlayIcon kind="group" />
                    </span>
                    <h2>Bring your people.</h2>
                    <p>Host ready-made trivia or create your own quiz.</p>
                    <Button
                        className="host-action"
                        fullWidth
                        onClick={() => go("/create")}
                    >
                        Create a room <PlayIcon kind="arrow" />
                    </Button>
                </div>
                <form
                    className="playground-mode join-flow"
                    aria-label="Join your friends"
                    onSubmit={joinRoom}
                >
                    <span className="playground-mode-icon">
                        <PlayIcon kind="play" />
                    </span>
                    <h2>Got an invite?</h2>
                    <label htmlFor="home-room-code">
                        Enter your six-character room code to join.
                    </label>
                    <div className="playground-join-controls">
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
                            className="playground-join"
                            type="submit"
                            aria-label="Join a room"
                            disabled={code.length !== 6}
                        >
                            <span>Join</span>
                            <PlayIcon kind="arrow" />
                        </Button>
                    </div>
                </form>
                <div className="playground-mode solo-action-row">
                    <span className="playground-mode-icon">
                        <PlayIcon />
                    </span>
                    <h2>Go solo.</h2>
                    <p>A little challenge. All for yourself.</p>
                    <Button
                        intent="secondary"
                        fullWidth
                        onClick={() => go("/solo")}
                    >
                        Play solo <PlayIcon kind="arrow" />
                    </Button>
                </div>
            </section>
            <div className="playground-footnote">
                <span>Free to play. No downloads. Just curiosity.</span>
                <span>
                    Made for good company <span aria-hidden="true">↗</span>
                </span>
            </div>
        </div>
    );
}
