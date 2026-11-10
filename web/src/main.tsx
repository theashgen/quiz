import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, type Account, type Catalog } from "./types";
import { Home } from "./components/Home";
import { SetupPage } from "./components/SetupPage";
import { Join } from "./components/Join";
import { Room } from "./components/Room";
import { ErrorMessage } from "./components/Common";
import { AuthPage, AccountPage, AccountMenu } from "./components/Auth";
import { normalizeRoomCode } from "./setup";
import "./tailwind.css";

function App() {
    const [route, setRoute] = useState(location.pathname + location.search);
    const path = route.split("?")[0];
    const [user, setUser] = useState<Account | null>(null);
    const [catalog, setCatalog] = useState<Catalog>();
    const [error, setError] = useState("");
    useEffect(() => {
        const update = () => setRoute(location.pathname + location.search);
        addEventListener("popstate", update);
        return () => removeEventListener("popstate", update);
    }, []);
    function go(path: string) {
        history.pushState(null, "", path);
        setRoute(location.pathname + location.search);
        window.scrollTo(0, 0);
    }
    useEffect(() => {
        let stopped = false;
        let retry: ReturnType<typeof setTimeout>;
        function bootstrap() {
            api("/session", {})
                .then(() =>
                    Promise.all([
                        api<Catalog>("/catalog"),
                        api<{ user: Account | null }>("/auth/me"),
                    ]),
                )
                .then(([c, account]) => {
                    if (!stopped) {
                        setCatalog(c);
                        setUser(account.user);
                        setError("");
                    }
                })
                .catch((e) => {
                    if (!stopped) {
                        setError(e.message);
                        retry = setTimeout(bootstrap, 3000);
                    }
                });
        }
        bootstrap();
        return () => {
            stopped = true;
            clearTimeout(retry);
        };
    }, []);
    useEffect(() => {
        const refresh = () => {
            api<{ user: Account | null }>("/auth/me")
                .then(({ user }) => setUser(user))
                .catch(() => {});
        };
        addEventListener("focus", refresh);
        return () => removeEventListener("focus", refresh);
    }, []);
    function authenticated(account: Account) {
        const next = new URLSearchParams(location.search).get("next");
        setUser(account);
        go(
            account.role === "teacher" &&
                (path === "/create" || next === "/create")
                ? "/create"
                : "/account",
        );
    }
    function signedOut() {
        setUser(null);
        go("/");
    }
    useEffect(() => {
        if (catalog && location.hash) {
            document.getElementById(location.hash.slice(1))?.scrollIntoView();
        }
    }, [catalog, path]);
    const room = /^\/room\/([A-Z0-9]{6})$/i.exec(path);
    const invite = /^\/join\/([^/]*)\/?$/i.exec(path);
    const isJoin = path === "/join" || !!invite;
    const isAuth = ["/signup", "/login", "/account"].includes(path);
    const isHome =
        !room &&
        !isJoin &&
        ![
            "/create",
            "/solo",
            "/join",
            "/signup",
            "/login",
            "/account",
        ].includes(path);
    return (
        <>
            {catalog && !isAuth && !room && <AccountMenu user={user} go={go} />}
            <main
                className={
                    isHome
                        ? "home-main"
                        : path === "/create"
                          ? "create-main"
                          : isJoin
                            ? "join-main"
                            : undefined
                }
            >
                {!catalog ? (
                    <div className="panel narrow">
                        <h1>
                            {error ? "Reconnecting…" : "Getting things ready…"}
                        </h1>
                        {error && (
                            <>
                                <ErrorMessage>{error}</ErrorMessage>
                                <button onClick={() => location.reload()}>
                                    Try again
                                </button>
                            </>
                        )}
                    </div>
                ) : room ? (
                    <Room
                        key={room[1]}
                        code={room[1].toUpperCase()}
                        catalog={catalog}
                        go={go}
                    />
                ) : isAuth ? (
                    user ? (
                        <AccountPage
                            user={user}
                            go={go}
                            onSignedOut={signedOut}
                        />
                    ) : (
                        <AuthPage
                            key={path}
                            mode={path === "/signup" ? "signup" : "login"}
                            go={go}
                            onAuthenticated={authenticated}
                        />
                    )
                ) : path === "/create" && user?.role !== "teacher" ? (
                    user ? (
                        <AccountPage
                            user={user}
                            go={go}
                            onSignedOut={signedOut}
                            hostingDenied
                        />
                    ) : (
                        <AuthPage
                            mode="login"
                            hosting
                            go={go}
                            onAuthenticated={authenticated}
                        />
                    )
                ) : path === "/create" ? (
                    <SetupPage
                        catalog={catalog}
                        accountName={user?.name}
                        onBack={() => go("/")}
                        onSubmit={async (setup) => {
                            const r = await api<{ code: string }>(
                                "/rooms",
                                setup,
                            );
                            go("/room/" + r.code);
                        }}
                    />
                ) : path === "/solo" ? (
                    <SetupPage
                        solo
                        catalog={catalog}
                        onBack={() => go("/")}
                        onSubmit={async (setup) => {
                            const r = await api<{ code: string }>(
                                "/solo",
                                setup,
                            );
                            go("/room/" + r.code);
                        }}
                    />
                ) : isJoin ? (
                    <Join
                        key={route}
                        catalog={catalog}
                        go={go}
                        defaultName={user?.name}
                        initialCode={
                            invite?.[1] ??
                            normalizeRoomCode(
                                new URLSearchParams(location.search).get(
                                    "code",
                                ) ?? "",
                            )
                        }
                    />
                ) : (
                    <Home go={go} />
                )}
            </main>
            {!isHome && (
                <footer className={isJoin ? "join-footer" : undefined}>
                    <span className="footer-brand">
                        quiz. <span>A little friendly competition.</span>
                    </span>
                    <span>
                        Made for the joy of knowing. Not knowing is fun, too.
                    </span>
                </footer>
            )}
        </>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
