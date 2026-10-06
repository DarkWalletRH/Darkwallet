import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Overview } from "./pages/Overview";
import { Verify } from "./pages/Verify";
import { Build } from "./pages/Build";
import "./styles.css";

// Three pages do not need a router library: the page is the URL hash (#/, #/verify, #/build).
const PAGES = {
  "": { label: "Network", Page: Overview },
  verify: { label: "Verify a disclosure", Page: Verify },
  build: { label: "Build your own", Page: Build },
};
type Route = keyof typeof PAGES;

const currentRoute = (): Route => {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return Object.hasOwn(PAGES, hash) ? (hash as Route) : "";
};

function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const { Page } = PAGES[route];

  return (
    <>
      <header className="top">
        <a className="brand" href="#/">
          Dark starter
        </a>
        <nav>
          {Object.entries(PAGES).map(([path, { label }]) => (
            <a key={path} href={`#/${path}`} aria-current={path === route ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <Page />
      </main>
      <footer>
        Read-only developer template. It never handles keys or sends transactions. MIT OR Apache-2.0.
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
