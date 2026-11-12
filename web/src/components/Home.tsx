import { useState, type FormEvent } from "react";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { normalizeRoomCode } from "../setup";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { ButtonGroup } from "./ButtonGroup";
import { PlaygroundTrophy, PlayIcon } from "./PeachArt";

export function Home({ go }: { go: (path: string) => void }) {
    const [code, setCode] = useState("");

    function joinRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (code.length === 6) go("/join?code=" + code);
    }

    return (
        <div className="home peach-home">
            <section className="playground-hero" aria-label="Quiz home">
                <div className="playground-intro">
                    <h1 className="home-action-heading">
                        Good questions. Great company.
                    </h1>
                    <p className="home-action-description">
                        Bring your people together for a quick quiz, or take on
                        a solo challenge. Free to play, with no sign-up needed
                        to join.
                    </p>
                    <section
                        className="playground-modes"
                        aria-label="Start playing"
                    >
                        <div className="playground-mode mode-host">
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger className="ui-button primary w-full host-action">
                                    <PlayIcon kind="group" />
                                    Create a room{" "}
                                    <span aria-hidden="true">⌄</span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    sideOffset={8}
                                    align="start"
                                    aria-label="Choose a room type"
                                >
                                    <DropdownMenuItem
                                        className="room-menu-item"
                                        onClick={() => go("/create")}
                                    >
                                        <PlayIcon kind="group" />
                                        <span>
                                            <strong>Host with friends</strong>
                                            <span>
                                                Create a multiplayer room.
                                            </span>
                                        </span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="room-menu-item"
                                        onClick={() => go("/solo")}
                                    >
                                        <PlayIcon kind="play" />
                                        <span>
                                            <strong>Create solo room</strong>
                                            <span>
                                                A little challenge. All for
                                                yourself.
                                            </span>
                                        </span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <form
                            className="playground-mode join-flow"
                            aria-label="Join your friends"
                            onSubmit={joinRoom}
                        >
                            <label className="sr-only" htmlFor="home-room-code">
                                Enter your six-character room code to join.
                            </label>
                            <ButtonGroup
                                className="playground-join-controls"
                                aria-label="Join with a room code"
                            >
                                <svg
                                    className="room-code-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    aria-hidden="true"
                                >
                                    <rect
                                        x="3"
                                        y="5"
                                        width="18"
                                        height="14"
                                        rx="2"
                                    />
                                    <path d="M6 9h2m3 0h2m3 0h2M6 12h2m3 0h2m3 0h2M8 15h8" />
                                </svg>
                                <Input
                                    id="home-room-code"
                                    className="home-code-input"
                                    aria-label="Room code"
                                    value={code}
                                    onChange={(event) =>
                                        setCode(
                                            normalizeRoomCode(
                                                event.target.value,
                                            ),
                                        )
                                    }
                                    placeholder="Enter a room code"
                                    required
                                    minLength={6}
                                    pattern="[A-Z0-9]{6}"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    spellCheck={false}
                                    enterKeyHint="go"
                                />
                                <Button
                                    intent="secondary"
                                    className="playground-join"
                                    type="submit"
                                    aria-label="Join a room"
                                    disabled={code.length !== 6}
                                >
                                    <span>Join</span>
                                </Button>
                            </ButtonGroup>
                        </form>
                    </section>
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
                <div className="playground-showcase">
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
