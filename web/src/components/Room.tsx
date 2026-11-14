import { Button as ShadcnButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Button } from "./Button";
import { useEffect, useRef, useState } from "react";
import type { Catalog } from "../types";
import { useRoom } from "../useRoom";
import { ErrorMessage } from "./Common";
import { SetupPage } from "./SetupPage";
import { Leaderboard } from "./Leaderboard";
import { Avatar } from "./Avatar";

export function Room({
    code,
    catalog,
    go,
}: {
    code: string;
    catalog: Catalog;
    go: (p: string) => void;
}) {
    const live = useRoom(code);
    const { snapshot: s, connection, error, pending, send } = live;
    const resultsPage = useRef<HTMLElement>(null);
    const replayActions = useRef<HTMLDivElement>(null);
    const restoreReplayFocus = useRef(false);
    const [flowActions, setFlowActions] = useState(false);
    const replayRequested = !!s?.members.find((member) => member.id === s.me)
        ?.replay;
    useEffect(() => {
        if (s?.status !== "results" || s.solo) return;
        const page = resultsPage.current;
        const dock = replayActions.current;
        if (!page || !dock) return;
        const media = window.matchMedia("(max-width: 740px)");
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            // Defer layout changes until after ResizeObserver's delivery phase.
            frame = requestAnimationFrame(() => {
                const dockHeight = dock.getBoundingClientRect().height;
                const pageHeight = page.clientHeight;
                setFlowActions(
                    (flowing) =>
                        media.matches &&
                        // Separate entry/exit thresholds prevent mode oscillation.
                        dockHeight > pageHeight * (flowing ? 0.39 : 0.4),
                );
            });
        };
        const observer = new ResizeObserver(update);
        observer.observe(page);
        observer.observe(dock);
        media.addEventListener("change", update);
        update();
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            media.removeEventListener("change", update);
        };
    }, [s?.status, s?.solo, s?.preparingNextQuiz]);
    useEffect(() => {
        if (!replayRequested || !restoreReplayFocus.current) return;
        restoreReplayFocus.current = false;
        const dock = replayActions.current;
        if (
            document.activeElement === document.body ||
            dock?.contains(document.activeElement)
        ) {
            dock?.querySelector<HTMLElement>(
                ".waiting, button:not(:disabled)",
            )?.focus();
        }
    }, [replayRequested]);
    const [now, setNow] = useState(Date.now());
    const [selected, setSelected] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [linkCopyError, setLinkCopyError] = useState(false);
    const inviteURL = new URL("/join/" + code, location.origin).href;
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        setSelected(null);
    }, [s?.personal?.question?.id, s?.roundId]);
    useEffect(() => {
        const personal = s?.personal;
        const question = personal?.question;
        if (
            connection !== "live" ||
            pending ||
            s?.status !== "active" ||
            personal?.phase !== "question" ||
            !question
        )
            return;

        function onKeyDown(event: KeyboardEvent) {
            if (
                event.defaultPrevented ||
                event.repeat ||
                event.isComposing ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                Date.now() + live.offset.current >= personal!.deadline
            )
                return;
            const target = event.target;
            if (
                target instanceof Element &&
                target.closest(
                    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"]',
                )
            )
                return;
            // Keep Enter's native behavior on navigation and unrelated controls.
            if (
                event.key === "Enter" &&
                target instanceof Element &&
                target.closest("a, button") &&
                !target.closest(".answer-option, [data-answer-submit]")
            )
                return;

            if (/^[1-9]$/.test(event.key)) {
                const choice = Number(event.key) - 1;
                if (choice < question!.options.length) {
                    event.preventDefault();
                    setSelected(choice);
                }
            } else if (event.key === "Enter" && selected !== null) {
                event.preventDefault();
                send("answer", { questionId: question!.id, choice: selected });
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [s, connection, pending, selected, send, live.offset]);
    const serverNow = now + live.offset.current;
    if (connection === "displaced")
        return (
            <div className="panel narrow status-panel">
                <span className="status-symbol">↗</span>
                <h1>This session is active in another tab.</h1>
                <p>Your progress is safe. Continue in the newer tab.</p>
                <Button intent="secondary" onClick={() => go("/")}>
                    Back to home
                </Button>
            </div>
        );
    if (!s || connection === "failed")
        return (
            <div className="panel narrow">
                <h1>
                    {connection === "failed"
                        ? "Couldn’t open this room."
                        : "Opening your room…"}
                </h1>
                {error && <ErrorMessage>{error}</ErrorMessage>}
                {connection === "failed" && (
                    <Button onClick={() => go("/join")}>
                        Enter a room code
                    </Button>
                )}
            </div>
        );
    const offline = connection !== "live";
    const disabled = offline || pending;
    const banner = (
        <>
            {offline && (
                <div role="status" className="notice">
                    Reconnecting… Your timer keeps running. We’ll restore your
                    progress when the connection returns.
                </div>
            )}
            {error && <ErrorMessage>{error}</ErrorMessage>}
        </>
    );
    if (s.isHost && s.status === "results" && s.preparingNextQuiz)
        return (
            <>
                {banner}
                <SetupPage
                    rematch
                    catalog={catalog}
                    onBack={() => send("cancel_prepare")}
                    onSubmit={async (setup) => {
                        if (disabled)
                            throw new Error("Wait for the live connection");
                        send("configure", { setup });
                    }}
                />
            </>
        );
    if (s.status === "expired")
        return (
            <div className="panel narrow status-panel">
                <span className="status-symbol">◷</span>
                <h1>This room’s time is up.</h1>
                <p>
                    The quiz wasn’t started within 10 minutes. Create a fresh
                    room to play.
                </p>
                <Button onClick={() => go("/create")}>Create a room</Button>
            </div>
        );
    if (s.status === "lobby")
        return (
            <section className="room-page">
                {banner}
                <div className="page-heading centered lobby-sharing">
                    <div className="lobby-intro">
                        <div className="eyebrow">
                            THE GANG’S GETTING TOGETHER
                        </div>
                        <h1>A good time is on its way.</h1>
                        <p>Share this code. Bring your people.</p>
                    </div>
                    <ShadcnButton
                        variant="unstyled"
                        className="room-code"
                        aria-label={`Copy room code ${code}`}
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(code);
                                setCopied(true);
                            } catch {
                                live.setError(
                                    "Copy unavailable. Select the room code to share it.",
                                );
                            }
                        }}
                    >
                        {code}
                        <small>{copied ? "Copied!" : "Copy code ⧉"}</small>
                    </ShadcnButton>
                    {s.isHost && !s.solo && (
                        <div className="lobby-invite">
                            <Button
                                intent="secondary"
                                className="invite-copy-button"
                                aria-label={
                                    linkCopied
                                        ? "Invite link copied"
                                        : "Copy invite link"
                                }
                                data-copied={linkCopied}
                                onClick={async () => {
                                    setLinkCopied(false);
                                    setLinkCopyError(false);
                                    try {
                                        await navigator.clipboard.writeText(
                                            inviteURL,
                                        );
                                        setLinkCopied(true);
                                    } catch {
                                        setLinkCopyError(true);
                                    }
                                }}
                            >
                                <span
                                    role="status"
                                    aria-live="polite"
                                    aria-atomic="true"
                                >
                                    {linkCopied
                                        ? "Invite link copied"
                                        : "Copy invite link"}
                                </span>
                                {linkCopied ? (
                                    <svg
                                        className="invite-copy-check"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path d="m4 10 4 4 8-8" />
                                    </svg>
                                ) : (
                                    <span
                                        className="invite-copy-icon"
                                        aria-hidden="true"
                                    >
                                        ⧉
                                    </span>
                                )}
                            </Button>
                            {linkCopyError && (
                                <>
                                    <Input
                                        variant="themed"
                                        aria-label="Invite players with a link"
                                        value={inviteURL}
                                        readOnly
                                        onFocus={(event) =>
                                            event.currentTarget.select()
                                        }
                                    />
                                    <ErrorMessage>
                                        Copy unavailable. Select and copy the
                                        invite link above.
                                    </ErrorMessage>
                                </>
                            )}
                        </div>
                    )}
                    <p className="fine-print">
                        Start within {formatTime(s.expiresAt - serverNow)} ·
                        joining won’t extend this deadline
                    </p>
                </div>
                <div className="lobby-grid">
                    <div className="panel lobby-players">
                        <div className="section-row">
                            <h2>Your people</h2>
                            <span className="pill">
                                {s.members.filter((m) => m.playing).length}{" "}
                                playing
                            </span>
                        </div>
                        <div className="player-grid">
                            {s.members
                                .filter((m) => m.playing || m.host)
                                .map((m) => (
                                    <div className="player" key={m.id}>
                                        <span className="player-avatar">
                                            <Avatar
                                                value={m.avatar}
                                                decorative
                                            />
                                        </span>
                                        <strong>
                                            {m.name}
                                            {m.id === s.me ? " (you)" : ""}
                                        </strong>
                                        <small>
                                            {m.host
                                                ? "Host" +
                                                  (m.playing
                                                      ? " · playing"
                                                      : " · hosting only")
                                                : "Ready to play"}
                                        </small>
                                    </div>
                                ))}
                        </div>
                        {s.members.filter((m) => m.playing).length === 0 && (
                            <p className="muted">
                                Waiting for the first player to join.
                            </p>
                        )}
                    </div>
                    <aside className="panel lobby-aside">
                        <div className="eyebrow">HOW WE PLAY</div>
                        <h2>Trust your gut.</h2>
                        <p>
                            Four options. 10 seconds per question. 100 points
                            for a correct answer.
                        </p>
                        <p>
                            Everyone gets the same questions in a different
                            order. Play at your own pace.
                        </p>
                        {s.isHost ? (
                            <Button
                                fullWidth
                                disabled={
                                    disabled ||
                                    !s.members.some((m) => m.playing)
                                }
                                onClick={() => send("start")}
                            >
                                Start the quiz →
                            </Button>
                        ) : s.enrolled ? (
                            <div className="waiting">
                                <span /> Waiting for the host to start
                            </div>
                        ) : (
                            <Button
                                fullWidth
                                disabled={disabled}
                                onClick={() => send("replay")}
                            >
                                Join this next quiz →
                            </Button>
                        )}
                    </aside>
                </div>
            </section>
        );
    const p = s.personal;
    if (s.status === "active" && p && p.phase !== "finished") {
        const reveal = p.phase === "reveal";
        const remaining = Math.max(0, (p.deadline - serverNow) / 1000);
        const q = p.question!;
        return (
            <section className="play-page">
                {banner}
                <div className="play-top">
                    <span className="eyebrow">
                        {s.solo ? "A LITTLE SOLO CHALLENGE" : "ROOM " + s.code}
                    </span>
                    <span className="pill">
                        Question {p.number} of {p.total}
                    </span>
                </div>
                <div className="progress-track">
                    <div
                        style={{
                            width: `${((p.number - 1) / p.total) * 100}%`,
                        }}
                    />
                </div>
                <div className="panel question-panel">
                    <div className="section-row">
                        <span className="eyebrow">
                            {reveal ? "THE CORRECT ANSWER" : "YOU’VE GOT THIS"}
                        </span>
                        {!reveal && (
                            <div
                                className={
                                    remaining < 3
                                        ? "countdown urgent"
                                        : "countdown"
                                }
                                role="timer"
                                aria-label={`${Math.ceil(remaining)} seconds remaining`}
                            >
                                ◷ {Math.ceil(remaining)}
                                <small>s</small>
                            </div>
                        )}
                    </div>
                    <h1>{q.text}</h1>
                    <div className="answer-options">
                        {q.options.map((option, i) => (
                            <ShadcnButton
                                variant="unstyled"
                                key={i}
                                disabled={reveal || disabled || remaining <= 0}
                                aria-pressed={selected === i}
                                aria-keyshortcuts={String(i + 1)}
                                className={
                                    "answer-option" +
                                    (selected === i ? " chosen" : "") +
                                    (reveal && p.receipt?.correct === i
                                        ? " correct"
                                        : "")
                                }
                                onClick={() => setSelected(i)}
                            >
                                <span className="option-letter">{i + 1}</span>
                                <span>{option}</span>
                                {reveal && p.receipt?.correct === i && (
                                    <span className="correct-mark">✓</span>
                                )}
                            </ShadcnButton>
                        ))}
                    </div>
                    {reveal ? (
                        <div className="reveal-footer" role="status">
                            Correct answer:{" "}
                            <strong>{q.options[p.receipt!.correct]}</strong>
                            <small>
                                Next{" "}
                                {p.number === p.total
                                    ? "up: your score"
                                    : "question"}{" "}
                                in{" "}
                                {Math.max(
                                    0,
                                    Math.ceil(
                                        (p.revealUntil - serverNow) / 1000,
                                    ),
                                )}
                                s
                            </small>
                        </div>
                    ) : (
                        <div className="question-bottom">
                            <span className="muted">
                                {remaining <= 0
                                    ? "Time’s up. Waiting for the server…"
                                    : pending
                                      ? "Submitting your answer…"
                                      : `Press 1–${q.options.length} to select, then Enter to submit.`}
                            </span>
                            <Button
                                data-answer-submit
                                aria-keyshortcuts="Enter"
                                disabled={
                                    disabled ||
                                    selected === null ||
                                    remaining <= 0
                                }
                                onClick={() =>
                                    send("answer", {
                                        questionId: q.id,
                                        choice: selected!,
                                    })
                                }
                            >
                                Submit answer →
                            </Button>
                        </div>
                    )}
                </div>
            </section>
        );
    }
    return (
        <section
            ref={resultsPage}
            className={`results-page${flowActions ? " flow-results" : ""}${s.status === "results" ? " podium-results" : ""}${s.solo ? " solo-results" : s.status === "results" ? " mobile-results" : ""}`}
        >
            <div className="results-content">
                {banner}
                {!s.isHost && s.preparingNextQuiz && (
                    <div className="notice" role="status">
                        <strong>Your host is setting up the next quiz…</strong>
                        <br />
                        Hang tight — the next lobby will appear here when it’s
                        ready.
                    </div>
                )}
                {!s.solo && (
                    <div className="page-heading centered">
                        <div className="results-intro">
                            <div className="result-star">✦</div>
                            <div className="eyebrow">
                                {s.status === "results"
                                    ? "THAT’S A WRAP"
                                    : "YOUR PART IS DONE"}
                            </div>
                            <h1>
                                {p
                                    ? "Nicely played."
                                    : s.status === "results"
                                      ? "A round well hosted."
                                      : "Let them cook."}
                            </h1>
                        </div>
                        {p && (
                            <div className="results-score">
                                <p>Your score</p>
                                <div className="big-score">
                                    {p.score}
                                    <small> / {p.total * 100}</small>
                                </div>
                            </div>
                        )}
                        <p className="results-caption">
                            {s.status === "active"
                                ? `${s.finished} of ${s.total} players finished. Final ranks appear when everyone is done.`
                                : s.solo
                                  ? "A little wiser. Ready for another?"
                                  : "The guesses are in. Here’s how everyone landed."}
                        </p>
                    </div>
                )}
                {s.status === "results" && (
                    <Leaderboard
                        entries={s.leaderboard ?? []}
                        currentPlayer={s.me}
                        solo={s.solo}
                        hideHeading={s.solo}
                        code={code}
                        onShowActions={() => {
                            replayActions.current?.scrollIntoView({
                                block: "start",
                                behavior: "instant",
                            });
                            replayActions.current
                                ?.querySelector<HTMLButtonElement>(
                                    "button:not(:disabled)",
                                )
                                ?.focus({ preventScroll: true });
                        }}
                    />
                )}
            </div>
            {s.status === "results" && (
                <div
                    className="replay-actions"
                    ref={replayActions}
                    role="group"
                    aria-label="Next round actions"
                >
                    <span className="sr-only" role="status">
                        {!s.isHost && s.preparingNextQuiz
                            ? "Your host is setting up the next quiz. Results remain available."
                            : ""}
                    </span>
                    {s.solo ? (
                        <Button onClick={() => go("/solo")}>
                            Another solo round →
                        </Button>
                    ) : (
                        <>
                            <p role="status">
                                {s.replayCount}{" "}
                                {s.replayCount === 1
                                    ? "player wants"
                                    : "players want"}{" "}
                                to play again
                            </p>
                            {(!!p || !s.isHost) &&
                                !s.members.find((m) => m.id === s.me)
                                    ?.replay && (
                                    <Button
                                        intent="secondary"
                                        className="replay-opt-in"
                                        disabled={disabled}
                                        onClick={() => {
                                            restoreReplayFocus.current = true;
                                            send("replay");
                                        }}
                                    >
                                        Count me in for another
                                    </Button>
                                )}
                            {!s.isHost &&
                                s.members.find((m) => m.id === s.me)?.replay &&
                                !s.preparingNextQuiz && (
                                    <div
                                        className="waiting"
                                        role="status"
                                        tabIndex={-1}
                                    >
                                        <span /> You’re in! Waiting for the host
                                        to set up the next quiz.
                                    </div>
                                )}
                            {s.isHost && (
                                <Button
                                    disabled={disabled}
                                    onClick={() => send("prepare")}
                                >
                                    Set up the next quiz →
                                </Button>
                            )}
                        </>
                    )}
                    <ShadcnButton
                        variant="unstyled"
                        className="text-button"
                        onClick={() => go("/")}
                    >
                        Back to home
                    </ShadcnButton>
                </div>
            )}
        </section>
    );
}

function formatTime(ms: number) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
