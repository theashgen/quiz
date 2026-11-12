import { Button as ShadcnButton } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "./Button";
import { useState, type FormEvent } from "react";
import { api, type Account } from "../types";
import { Avatar } from "./Avatar";
import { ErrorMessage } from "./Common";

export function AuthPage({
    mode,
    go,
    onAuthenticated,
}: {
    mode: "signup" | "login";
    go: (path: string) => void;
    onAuthenticated: (user: Account) => void;
}) {
    const signup = mode === "signup";
    const [role, setRole] = useState<Account["role"]>("teacher");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const next =
        new URLSearchParams(location.search).get("next") === "/create"
            ? "?next=/create"
            : "";

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            const { user } = await api<{ user: Account }>(
                `/auth/${mode}`,
                signup
                    ? { name: name.trim(), email: email.trim(), password, role }
                    : { email: email.trim(), password },
            );
            setPassword("");
            onAuthenticated(user);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="auth-page" aria-labelledby="auth-heading">
            <ShadcnButton
                variant="unstyled"
                className="back text-button"
                onClick={() => go("/")}
            >
                ← Back to home
            </ShadcnButton>
            <div className="auth-layout">
                <div className="auth-welcome">
                    <div className="eyebrow">
                        GOOD QUESTIONS. GREAT COMPANY.
                    </div>
                    <h1>
                        Good things
                        <br /> start with <span>you.</span>
                    </h1>
                    <p>
                        A space for curious minds.
                        <br />
                        Teach a little. Learn a lot. Have some fun.
                    </p>
                    <div className="auth-people" aria-hidden="true">
                        <span className="auth-person">
                            <Avatar value="memoji-21" decorative />
                        </span>
                        <span className="auth-person">
                            <Avatar value="memoji-1" decorative />
                        </span>
                        <span className="auth-person">
                            <Avatar value="memoji-58" decorative />
                        </span>
                        <span className="auth-people-spark">✦</span>
                    </div>
                    <div className="auth-guest-note">
                        <strong>Just here for a quiz?</strong>
                        <span>
                            You can still join as a guest. No account needed.
                        </span>
                        <ShadcnButton
                            variant="unstyled"
                            className="text-button"
                            onClick={() => go("/join")}
                        >
                            Join a room instead ↗
                        </ShadcnButton>
                    </div>
                </div>
                <div className="auth-form-column">
                    <div className="eyebrow">
                        {signup
                            ? "MAKE YOURSELF AT HOME"
                            : "GOOD TO HAVE YOU BACK"}
                    </div>
                    <h2 id="auth-heading">
                        {signup ? "A little introduction." : "Welcome back."}
                    </h2>
                    <p className="auth-description">
                        {signup
                            ? "One account. A whole lot of curiosity."
                            : "Your people and your next quiz are waiting."}
                    </p>
                    <form onSubmit={submit}>
                        {signup && (
                            <RadioGroup
                                render={<fieldset />}
                                className="auth-roles"
                                name="account-role"
                                value={role}
                                onValueChange={(value) =>
                                    setRole(value as "teacher" | "student")
                                }
                            >
                                <legend>I’m joining as a</legend>
                                {(["teacher", "student"] as const).map(
                                    (choice) => (
                                        <RadioGroupItem
                                            render={<label />}
                                            key={choice}
                                            value={choice}
                                            disabled={busy}
                                            className={`auth-role${role === choice ? " selected" : ""}`}
                                        >
                                            <span
                                                className="auth-role-check"
                                                aria-hidden="true"
                                            >
                                                {role === choice ? "●" : "○"}
                                            </span>
                                            <strong>
                                                {choice === "teacher"
                                                    ? "Teacher"
                                                    : "Student"}
                                            </strong>
                                            <small>
                                                {choice === "teacher"
                                                    ? "Create quizzes. Bring your class."
                                                    : "Join quizzes. Follow your curiosity."}
                                            </small>
                                        </RadioGroupItem>
                                    ),
                                )}
                            </RadioGroup>
                        )}
                        {signup && (
                            <Label>
                                Your name
                                <Input
                                    variant="themed"
                                    autoComplete="name"
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    required
                                    maxLength={30}
                                    placeholder="What should we call you?"
                                    disabled={busy}
                                />
                            </Label>
                        )}
                        <Label>
                            Email address
                            <Input
                                variant="themed"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                required
                                maxLength={254}
                                placeholder="you@example.com"
                                autoCapitalize="none"
                                spellCheck={false}
                                disabled={busy}
                            />
                        </Label>
                        <Label htmlFor="account-password">Password</Label>
                        <div className="auth-password">
                            <Input
                                variant="themed"
                                id="account-password"
                                type={visible ? "text" : "password"}
                                autoComplete={
                                    signup ? "new-password" : "current-password"
                                }
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                required
                                minLength={signup ? 12 : undefined}
                                maxLength={1024}
                                placeholder={
                                    signup
                                        ? "At least 12 characters"
                                        : "Your password"
                                }
                                aria-describedby={
                                    signup ? "password-hint" : undefined
                                }
                                disabled={busy}
                            />
                            <ShadcnButton
                                variant="unstyled"
                                type="button"
                                aria-label={
                                    visible ? "Hide password" : "Show password"
                                }
                                aria-pressed={visible}
                                onClick={() => setVisible(!visible)}
                            >
                                {visible ? "Hide" : "Show"}
                            </ShadcnButton>
                        </div>
                        {signup && (
                            <p id="password-hint" className="auth-field-hint">
                                12+ characters. A short sentence works nicely.
                            </p>
                        )}
                        {error && <ErrorMessage>{error}</ErrorMessage>}
                        <Button
                            fullWidth
                            type="submit"
                            className="auth-submit"
                            disabled={busy}
                        >
                            {busy
                                ? "One moment…"
                                : signup
                                  ? `Create ${role} account →`
                                  : "Sign in →"}
                        </Button>
                    </form>
                    <p className="auth-switch">
                        {signup
                            ? "Already part of the fun?"
                            : "New around here?"}{" "}
                        <ShadcnButton
                            variant="unstyled"
                            className="text-button"
                            onClick={() =>
                                go(`${signup ? "/login" : "/signup"}${next}`)
                            }
                        >
                            {signup ? "Sign in" : "Create an account"}
                        </ShadcnButton>
                    </p>
                    {signup && (
                        <p className="auth-field-hint">
                            Choose the role that fits you. Teacher status is
                            self-selected, not institution-verified.
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}

export function AccountMenu({
    user,
    go,
}: {
    user: Account | null;
    go: (path: string) => void;
}) {
    return (
        <div className="account-navigation">
            {user?.role === "teacher" && (
                <Button
                    intent="secondary"
                    size="small"
                    className="question-bank-shortcut"
                    onClick={() => go("/create?source=custom")}
                >
                    Question bank
                </Button>
            )}
            {user ? (
                <ShadcnButton
                    variant="unstyled"
                    className="text-button account-link"
                    onClick={() => go("/account")}
                >
                    <span className="account-dot" />
                    {user.name}
                    <span className="account-role-label">{user.role}</span>
                </ShadcnButton>
            ) : (
                <>
                    <ShadcnButton
                        variant="unstyled"
                        className="text-button"
                        onClick={() => go("/login")}
                    >
                        Sign in
                    </ShadcnButton>
                    <Button
                        intent="secondary"
                        className="account-signup"
                        onClick={() => go("/signup")}
                    >
                        Create an account ↗
                    </Button>
                </>
            )}
        </div>
    );
}

export function AccountPage({
    user,
    go,
    onSignedOut,
    hostingDenied = false,
}: {
    user: Account;
    go: (path: string) => void;
    onSignedOut: () => void;
    hostingDenied?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function logout() {
        setBusy(true);
        setError("");
        try {
            await api("/auth/logout", {});
            onSignedOut();
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="account-page">
            <ShadcnButton
                variant="unstyled"
                className="back text-button"
                onClick={() => go("/")}
            >
                ← Back to home
            </ShadcnButton>
            <div className="eyebrow">YOUR LITTLE CORNER</div>
            <div className="account-heading">
                <div>
                    <h1>Hey, {user.name}.</h1>
                    <p className="muted">
                        {user.role === "teacher"
                            ? "Good questions bring people together. What will you ask today?"
                            : "There’s always something new to know. Ready to jump in?"}
                    </p>
                </div>
                <span className="account-role-badge">
                    {user.role === "teacher" ? "Teacher" : "Student"} account
                </span>
            </div>
            {hostingDenied && (
                <div className="notice" role="status">
                    Only teachers can create quizzes. You can join a room or
                    play solo with your student account.
                </div>
            )}
            <div className="account-actions">
                {user.role === "teacher" && (
                    <Button onClick={() => go("/create")}>
                        Create a quiz →
                    </Button>
                )}
                <Button intent="secondary" onClick={() => go("/join")}>
                    Join a room ↗
                </Button>
                <ShadcnButton
                    variant="unstyled"
                    className="text-button"
                    onClick={() => go("/solo")}
                >
                    Play solo ↗
                </ShadcnButton>
            </div>
            <dl className="account-details">
                <div>
                    <dt>Your name</dt>
                    <dd>{user.name}</dd>
                </div>
                <div>
                    <dt>Email address</dt>
                    <dd>{user.email}</dd>
                </div>
                <div>
                    <dt>Your role</dt>
                    <dd>
                        {user.role === "teacher"
                            ? "Teacher · create and host quizzes"
                            : "Student · join quizzes and play solo"}
                    </dd>
                </div>
            </dl>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <ShadcnButton
                variant="unstyled"
                className="text-button"
                disabled={busy}
                onClick={logout}
            >
                {busy ? "Signing out…" : "Sign out of your account →"}
            </ShadcnButton>
            <p className="auth-field-hint">
                Guest joining stays available after you sign out.
            </p>
        </section>
    );
}
