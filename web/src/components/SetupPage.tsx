import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Catalog, Setup, Question } from "../types";
import { base, blank } from "../setup";
import { createId } from "../id";
import { ErrorMessage, Identity } from "./Common";
import "../custom-setup.css";

type Saved = { id: string; name: string; questions: Question[] };

function isQuestionReady(question: Question) {
    const options = question.options.map((option) =>
        option.trim().toLowerCase(),
    );
    return (
        Boolean(question.text.trim()) &&
        options.every(Boolean) &&
        new Set(options).size === 4
    );
}

export function SetupPage({
    catalog,
    solo = false,
    rematch = false,
    onBack,
    onSubmit,
    accountName,
}: {
    catalog: Catalog;
    solo?: boolean;
    rematch?: boolean;
    onBack: () => void;
    onSubmit: (s: Setup) => Promise<void>;
    accountName?: string;
}) {
    const [setup, setSetup] = useState<Setup>(() => ({
        ...base(),
        ...(accountName ? { name: accountName } : {}),
    }));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState<Saved[]>([]);
    const [saveName, setSaveName] = useState("My quiz");
    const [saveStatus, setSaveStatus] = useState("");
    const questionFields = useRef<(HTMLTextAreaElement | null)[]>([]);
    const focusNewQuestion = useRef(false);
    const readyCount = setup.questions!.filter(isQuestionReady).length;
    useEffect(() => {
        if (focusNewQuestion.current) {
            questionFields.current[setup.questions!.length - 1]?.focus();
            focusNewQuestion.current = false;
        }
    }, [setup.questions]);
    useEffect(() => {
        try {
            const stored = JSON.parse(
                localStorage.getItem("quiz.custom.v1") ?? "[]",
            );
            if (
                !Array.isArray(stored) ||
                !stored.every(
                    (v: Saved) =>
                        v &&
                        typeof v.id === "string" &&
                        typeof v.name === "string" &&
                        Array.isArray(v.questions) &&
                        v.questions.length > 0 &&
                        v.questions.every(
                            (q) =>
                                q &&
                                typeof q.text === "string" &&
                                Array.isArray(q.options) &&
                                q.options.length === 4 &&
                                q.options.every((o) => typeof o === "string") &&
                                Number.isInteger(q.correct) &&
                                q.correct >= 0 &&
                                q.correct <= 3,
                        ),
                )
            )
                throw Error();
            setSaved(stored);
        } catch {
            setError(
                "Browser storage is unavailable or saved data is invalid. You can still create a quiz.",
            );
        }
    }, []);

    function persist(items: Saved[]) {
        try {
            localStorage.setItem("quiz.custom.v1", JSON.stringify(items));
            setSaved(items);
            setSaveStatus("Saved quizzes updated in this browser.");
        } catch {
            setError(
                "Unable to save in this browser. Your editor is still available; do not close this page until you finish.",
            );
        }
    }

    function updateQ(index: number, q: Question) {
        setSetup({
            ...setup,
            questions: setup.questions!.map((v, i) => (i === index ? q : v)),
        });
    }

    function move(index: number, delta: number) {
        const qs = [...setup.questions!];
        [qs[index], qs[index + delta]] = [qs[index + delta], qs[index]];
        setSetup({ ...setup, questions: qs });
    }

    async function submit(e: FormEvent) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            await onSubmit({
                ...setup,
                participate:
                    solo || (setup.source === "preset" && setup.participate),
            });
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section
            className={`setup-page${!solo && !rematch ? " create-page" : ""}${setup.source === "custom" ? " custom-setup" : ""}`}
        >
            <button className="back text-button" onClick={onBack}>
                ← {rematch ? "Back to results" : "Back to home"}
            </button>
            <div className="page-heading">
                <div className="eyebrow">
                    {solo
                        ? "A MOMENT FOR YOUR MIND"
                        : rematch
                          ? "ANOTHER ROUND OF GOOD TIMES"
                          : "BRING YOUR PEOPLE"}
                </div>
                {(solo || rematch) && (
                    <>
                        <h1>
                            {solo
                                ? "Follow your curiosity."
                                : "Keep the questions coming."}
                        </h1>
                        <p>
                            {solo
                                ? "Pick your topics. We’ll take care of the questions."
                                : "A private quiz, a shared code, and a little friendly competition."}
                        </p>
                    </>
                )}
            </div>
            <form onSubmit={submit}>
                {!solo && (
                    <fieldset className="source-tabs">
                        <legend className="sr-only">Question source</legend>
                        <button
                            type="button"
                            aria-pressed={setup.source === "preset"}
                            className={
                                setup.source === "preset" ? "selected" : ""
                            }
                            onClick={() =>
                                setSetup({ ...setup, source: "preset" })
                            }
                        >
                            <strong>✦ Ready-made trivia</strong>
                            <span>Pick topics. Get playing.</span>
                        </button>
                        <button
                            type="button"
                            aria-pressed={setup.source === "custom"}
                            className={
                                setup.source === "custom" ? "selected" : ""
                            }
                            onClick={() =>
                                setSetup({
                                    ...setup,
                                    source: "custom",
                                    participate: false,
                                })
                            }
                        >
                            <strong>✎ Your own questions</strong>
                            <span>You create. You host.</span>
                        </button>
                    </fieldset>
                )}
                <div className="setup-grid">
                    <div
                        className={
                            setup.source === "custom"
                                ? "setup-main custom-editor"
                                : "panel setup-main"
                        }
                    >
                        {setup.source === "preset" ? (
                            <>
                                <h2>What’s your thing?</h2>
                                <p className="muted">
                                    Choose one or more topics.
                                </p>
                                <div className="categories">
                                    {Object.entries(catalog.categories)
                                        .sort()
                                        .map(([c, count]) => (
                                            <label
                                                className={
                                                    setup.categories.includes(c)
                                                        ? "category selected"
                                                        : "category"
                                                }
                                                key={c}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={setup.categories.includes(
                                                        c,
                                                    )}
                                                    onChange={(e) =>
                                                        setSetup({
                                                            ...setup,
                                                            categories: e.target
                                                                .checked
                                                                ? [
                                                                      ...setup.categories,
                                                                      c,
                                                                  ]
                                                                : setup.categories.filter(
                                                                      (x) =>
                                                                          x !==
                                                                          c,
                                                                  ),
                                                        })
                                                    }
                                                />
                                                <span>
                                                    {
                                                        (
                                                            {
                                                                Science: "⚗",
                                                                History: "⌛",
                                                                Computers: "⌘",
                                                                "General Knowledge":
                                                                    "✦",
                                                            } as Record<
                                                                string,
                                                                string
                                                            >
                                                        )[c]
                                                    }
                                                </span>
                                                <strong>{c}</strong>
                                                <small>
                                                    {count} development
                                                    questions
                                                </small>
                                            </label>
                                        ))}
                                </div>
                                <fieldset>
                                    <legend>How many questions?</legend>
                                    <div className="segmented">
                                        {catalog.lengths.map((n) => (
                                            <button
                                                className={
                                                    setup.count === n
                                                        ? "selected"
                                                        : ""
                                                }
                                                key={n}
                                                type="button"
                                                aria-pressed={setup.count === n}
                                                onClick={() =>
                                                    setSetup({
                                                        ...setup,
                                                        count: n,
                                                    })
                                                }
                                            >
                                                {n}
                                                <small>questions</small>
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                                <p className="fine-print">
                                    {catalog.provenance}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="quiz-draft">
                                    <div className="save-controls">
                                        <label>
                                            Quiz title
                                            <input
                                                value={saveName}
                                                onChange={(e) =>
                                                    setSaveName(e.target.value)
                                                }
                                                maxLength={80}
                                                placeholder="Give your quiz a name"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            className="outline"
                                            onClick={() => {
                                                if (!saveName.trim()) {
                                                    setError(
                                                        "Name your saved quiz first",
                                                    );
                                                    return;
                                                }
                                                persist([
                                                    ...saved,
                                                    {
                                                        id: createId(),
                                                        name: saveName.trim(),
                                                        questions:
                                                            structuredClone(
                                                                setup.questions!,
                                                            ),
                                                    },
                                                ]);
                                            }}
                                        >
                                            Save a copy
                                        </button>
                                    </div>
                                    <p className="fine-print">
                                        A work in progress? Save a draft before
                                        you leave. It stays in this browser
                                        only.
                                    </p>
                                    {saveStatus && (
                                        <p
                                            role="status"
                                            className="draft-status"
                                        >
                                            {saveStatus}
                                        </p>
                                    )}
                                </div>
                                <details
                                    className="saved-quizzes"
                                    open={saved.length > 0}
                                >
                                    <summary>
                                        Saved in this browser{" "}
                                        <span>{saved.length}</span>
                                    </summary>
                                    {saved.length === 0 ? (
                                        <p className="muted">
                                            Your saved drafts will live here.
                                            Start with a question below.
                                        </p>
                                    ) : (
                                        saved.map((quiz) => (
                                            <div
                                                key={quiz.id}
                                                className="saved-row"
                                            >
                                                <span>
                                                    {quiz.name}{" "}
                                                    <small>
                                                        ({quiz.questions.length}
                                                        )
                                                    </small>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    onClick={() => {
                                                        setSetup({
                                                            ...setup,
                                                            questions:
                                                                structuredClone(
                                                                    quiz.questions,
                                                                ),
                                                        });
                                                        setSaveName(quiz.name);
                                                        setSaveStatus(
                                                            "Quiz loaded into the editor.",
                                                        );
                                                    }}
                                                >
                                                    Open
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    onClick={() =>
                                                        persist(
                                                            saved.filter(
                                                                (item) =>
                                                                    item.id !==
                                                                    quiz.id,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </details>
                                <div className="question-list-heading">
                                    <h3>The lineup</h3>
                                    <span aria-live="polite">
                                        {readyCount} of{" "}
                                        {setup.questions!.length} ready
                                    </span>
                                </div>
                                {setup.questions!.map((q, i) => (
                                    <div className="editor-question" key={i}>
                                        <div className="section-row">
                                            <div className="question-card-title">
                                                <span className="question-number">
                                                    {String(i + 1).padStart(
                                                        2,
                                                        "0",
                                                    )}
                                                </span>
                                                <h3>Question {i + 1}</h3>
                                                <span
                                                    className={`question-state${isQuestionReady(q) ? " ready" : ""}`}
                                                >
                                                    {isQuestionReady(q)
                                                        ? "Ready"
                                                        : "Draft"}
                                                </span>
                                            </div>
                                            <div className="editor-actions">
                                                <button
                                                    type="button"
                                                    aria-label={`Move question ${i + 1} up`}
                                                    title="Move up"
                                                    disabled={i === 0}
                                                    onClick={() => move(i, -1)}
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Move question ${i + 1} down`}
                                                    title="Move down"
                                                    disabled={
                                                        i ===
                                                        setup.questions!
                                                            .length -
                                                            1
                                                    }
                                                    onClick={() => move(i, 1)}
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Duplicate question ${i + 1}`}
                                                    title="Duplicate question"
                                                    onClick={() => {
                                                        focusNewQuestion.current = true;
                                                        setSetup({
                                                            ...setup,
                                                            questions: [
                                                                ...setup.questions!,
                                                                structuredClone(
                                                                    q,
                                                                ),
                                                            ],
                                                        });
                                                    }}
                                                >
                                                    <svg
                                                        width="15"
                                                        height="15"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.7"
                                                        aria-hidden="true"
                                                    >
                                                        <rect
                                                            x="8"
                                                            y="8"
                                                            width="12"
                                                            height="12"
                                                            rx="2"
                                                        />
                                                        <path d="M16 8V4H4v12h4" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Delete question ${i + 1}`}
                                                    title="Delete question"
                                                    disabled={
                                                        setup.questions!
                                                            .length === 1
                                                    }
                                                    onClick={() =>
                                                        setSetup({
                                                            ...setup,
                                                            questions:
                                                                setup.questions!.filter(
                                                                    (_, j) =>
                                                                        j !== i,
                                                                ),
                                                        })
                                                    }
                                                >
                                                    <svg
                                                        width="15"
                                                        height="15"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.7"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <label>
                                            Question text
                                            <textarea
                                                ref={(element) => {
                                                    questionFields.current[i] =
                                                        element;
                                                }}
                                                required
                                                maxLength={2000}
                                                value={q.text}
                                                onChange={(e) =>
                                                    updateQ(i, {
                                                        ...q,
                                                        text: e.target.value,
                                                    })
                                                }
                                                placeholder="What would you like to ask?"
                                            />
                                        </label>
                                        <fieldset>
                                            <legend>
                                                Answer options{" "}
                                                <span>
                                                    · select the correct answer
                                                </span>
                                            </legend>
                                            <div className="editor-options">
                                                {q.options.map((o, j) => (
                                                    <div
                                                        className={`editor-option${q.correct === j ? " correct-option" : ""}`}
                                                        key={j}
                                                    >
                                                        <label
                                                            className="answer-selector"
                                                            title={`Mark ${"ABCD"[j]} as correct`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                aria-label={`Question ${i + 1}: option ${"ABCD"[j]} is correct`}
                                                                name={
                                                                    "correct-" +
                                                                    i
                                                                }
                                                                checked={
                                                                    q.correct ===
                                                                    j
                                                                }
                                                                onChange={() =>
                                                                    updateQ(i, {
                                                                        ...q,
                                                                        correct:
                                                                            j,
                                                                    })
                                                                }
                                                            />
                                                            <span aria-hidden="true">
                                                                {"ABCD"[j]}
                                                            </span>
                                                        </label>
                                                        <label
                                                            className="sr-only"
                                                            htmlFor={`option-${i}-${j}`}
                                                        >
                                                            Question {i + 1},
                                                            option {"ABCD"[j]}
                                                        </label>
                                                        <input
                                                            id={`option-${i}-${j}`}
                                                            required
                                                            maxLength={500}
                                                            placeholder={`Option ${"ABCD"[j]}`}
                                                            value={o}
                                                            onChange={(e) =>
                                                                updateQ(i, {
                                                                    ...q,
                                                                    options:
                                                                        q.options.map(
                                                                            (
                                                                                v,
                                                                                k,
                                                                            ) =>
                                                                                k ===
                                                                                j
                                                                                    ? e
                                                                                          .target
                                                                                          .value
                                                                                    : v,
                                                                        ),
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="answer-hint">
                                                {new Set(
                                                    q.options
                                                        .filter((option) =>
                                                            option.trim(),
                                                        )
                                                        .map((option) =>
                                                            option
                                                                .trim()
                                                                .toLowerCase(),
                                                        ),
                                                ).size !==
                                                q.options.filter((option) =>
                                                    option.trim(),
                                                ).length
                                                    ? "Each answer needs to be different."
                                                    : `Answer ${"ABCD"[q.correct]} is marked correct. Click another letter to change it.`}
                                            </p>
                                        </fieldset>
                                    </div>
                                ))}
                                <button
                                    className="outline full add-question"
                                    type="button"
                                    onClick={() => {
                                        focusNewQuestion.current = true;
                                        setSetup({
                                            ...setup,
                                            questions: [
                                                ...setup.questions!,
                                                blank(),
                                            ],
                                        });
                                    }}
                                >
                                    + Add a question
                                </button>
                            </>
                        )}
                    </div>
                    <aside className="panel setup-aside">
                        <div className="eyebrow">
                            {setup.source === "custom"
                                ? "YOUR HOST DESK"
                                : "THE LITTLE DETAILS"}
                        </div>
                        <h2>
                            {setup.source === "custom"
                                ? "Set the scene."
                                : "Make it yours."}
                        </h2>
                        <div className="timer-setting">
                            <span>◷</span>
                            <div>
                                <strong>10 seconds per question</strong>
                                <small>Plus a 2-second answer reveal</small>
                            </div>
                        </div>
                        <p className="fine-print">
                            {setup.source === "custom"
                                ? "You host, they answer. Every question is included, shuffled for each player."
                                : "The same timer applies to every question."}
                        </p>
                        {!solo && (
                            <>
                                <Identity
                                    setup={setup}
                                    onChange={setSetup}
                                    catalog={catalog}
                                />
                                {setup.source === "preset" && (
                                    <label className="checkbox">
                                        <input
                                            type="checkbox"
                                            checked={setup.participate}
                                            onChange={(e) =>
                                                setSetup({
                                                    ...setup,
                                                    participate:
                                                        e.target.checked,
                                                })
                                            }
                                        />
                                        <span>
                                            I’m playing too
                                            <small>
                                                Uncheck to host without
                                                answering.
                                            </small>
                                        </span>
                                    </label>
                                )}
                            </>
                        )}
                        {error && <ErrorMessage>{error}</ErrorMessage>}
                        <button
                            className="primary full"
                            disabled={
                                busy ||
                                (setup.source === "preset" &&
                                    !setup.categories.length)
                            }
                        >
                            {busy
                                ? "Getting ready…"
                                : solo
                                  ? "Let’s play →"
                                  : rematch
                                    ? "Open next lobby →"
                                    : "Create my room →"}
                        </button>
                        <p className="fine-print">
                            {solo
                                ? "No waiting room. Your quiz starts immediately."
                                : "Your lobby stays open for 10 minutes. Only you can start the quiz."}
                        </p>
                    </aside>
                </div>
            </form>
        </section>
    );
}
