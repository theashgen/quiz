import { useState, type FormEvent } from "react";
import { api, type Catalog } from "../types";
import { base, normalizeRoomCode } from "../setup";
import { ErrorMessage } from "./Common";
import { AvatarPicker } from "./AvatarPicker";
import "../join.css";

export function Join({
    catalog,
    go,
}: {
    catalog: Catalog;
    go: (p: string) => void;
}) {
    const initialCode = normalizeRoomCode(
        new URLSearchParams(location.search).get("code") ?? "",
    );
    const [code, setCode] = useState(initialCode);
    const [setup, setSetup] = useState({ ...base(), name: "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            const r = await api<{ code: string }>(
                "/rooms/" + code.toUpperCase() + "/join",
                { name: setup.name, avatar: setup.avatar },
            );
            go("/room/" + r.code);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="join-page" aria-labelledby="join-heading">
            <button className="back text-button" onClick={() => go("/")}>
                ← Back to home
            </button>
            <form className="join-layout" onSubmit={submit}>
                <div className="join-welcome">
                    <div className="eyebrow">A FACE FOR THE GAME</div>
                    <AvatarPicker
                        carousel
                        avatars={catalog.avatars}
                        value={setup.avatar}
                        onChange={(avatar) => setSetup({ ...setup, avatar })}
                    />
                    <label className="join-name">
                        Your name
                        <input
                            required
                            maxLength={30}
                            value={setup.name}
                            onChange={(event) =>
                                setSetup({ ...setup, name: event.target.value })
                            }
                            placeholder="What should we call you?"
                            autoComplete="nickname"
                            autoFocus={initialCode.length === 6}
                        />
                    </label>
                    <p className="join-identity-note">
                        Pick a face. Add your name. Make it yours.
                    </p>
                </div>
                <div className="join-form-panel">
                    <div className="eyebrow">YOUR INVITE STARTS HERE</div>
                    <h1 id="join-heading">Make yourself known.</h1>
                    <p className="muted">
                        Got a code? You’re in the right place.
                    </p>
                    <div className="join-code-form">
                        <label>
                            Room code
                            <input
                                className="code-input"
                                value={code}
                                onChange={(e) =>
                                    setCode(normalizeRoomCode(e.target.value))
                                }
                                required
                                minLength={6}
                                maxLength={6}
                                placeholder="ABC123"
                                autoCapitalize="characters"
                                autoComplete="off"
                                spellCheck={false}
                                aria-describedby="join-code-hint"
                            />
                            <span
                                className="join-field-hint"
                                id="join-code-hint"
                            >
                                The 6-character code shared by your host.
                            </span>
                        </label>
                        {error && <ErrorMessage>{error}</ErrorMessage>}
                        <button className="primary full" disabled={busy}>
                            {busy ? "Joining…" : "Join the room →"}
                        </button>
                        <p className="join-form-note">
                            Your next great guess is waiting.
                        </p>
                    </div>
                    <div className="join-entry-note">
                        <span aria-hidden="true">↗</span>
                        <div>
                            <strong>A little friendly competition.</strong>
                            <span>
                                No account needed. Just your best guesses.
                            </span>
                        </div>
                    </div>
                </div>
            </form>
        </section>
    );
}
