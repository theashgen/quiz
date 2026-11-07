import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, type Catalog } from "./types";
import { Home } from "./components/Home";
import { SetupPage } from "./components/SetupPage";
import { Join } from "./components/Join";
import { Room } from "./components/Room";
import { ErrorMessage } from "./components/Common";
import "./style.css";
import "./motion.css";

function App() {
  const [path, setPath] = useState(location.pathname);
  console.log(location)
  const [catalog, setCatalog] = useState<Catalog>();
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () => setPath(location.pathname);
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  function go(path: string) {
    history.pushState(null, "", path);
    setPath(location.pathname);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    function bootstrap() {
      api("/session", {})
        .then(() => api<Catalog>("/catalog"))
        .then((c) => {
          if (!stopped) {
            setCatalog(c);
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
    if (catalog && location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }, [catalog, path]);
  const room = /^\/room\/([A-Z0-9]{6})$/i.exec(path);
  const isHome = !room && !["/create", "/solo", "/join"].includes(path);
  return (
    <>
      <main
        className={
          isHome ? "home-main" : path === "/create" ? "create-main" : path === "/join" ? "join-main" : undefined
        }
      >
        {!catalog ? (
          <div className="panel narrow">
            <h1>{error ? "Reconnecting…" : "Getting things ready…"}</h1>
            {error && (
              <>
                <ErrorMessage>{error}</ErrorMessage>
                <button onClick={() => location.reload()}>Try again</button>
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
        ) : path === "/create" ? (
          <SetupPage
            catalog={catalog}
            onBack={() => go("/")}
            onSubmit={async (setup) => {
              const r = await api<{ code: string }>("/rooms", setup);
              go("/room/" + r.code);
            }}
          />
        ) : path === "/solo" ? (
          <SetupPage
            solo
            catalog={catalog}
            onBack={() => go("/")}
            onSubmit={async (setup) => {
              const r = await api<{ code: string }>("/solo", setup);
              go("/room/" + r.code);
            }}
          />
        ) : path === "/join" ? (
          <Join catalog={catalog} go={go} />
        ) : (
          <Home go={go} />
        )}
      </main>
      {!isHome && (
        <footer className={path === "/join" ? "join-footer" : undefined}>
          <span className="footer-brand">
            quiz. <span>A little friendly competition.</span>
          </span>
          <span>Made for the joy of knowing. Not knowing is fun, too.</span>
        </footer>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
