import { useState, type FormEvent, type ReactNode } from "react";
import { useLoupe } from "../state";
import { href } from "../router";
import { Sidebar } from "./Sidebar";

export function Shell({ children }: { children: ReactNode }) {
  const { mode, setMode, canDark } = useLoupe();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) window.location.hash = href("search", q.trim());
  };
  return (
    <div className="dl-app">
      <Sidebar />
      <div className="dl-main">
        <header className="dl-topbar">
          <form onSubmit={submit} role="search">
            <input className="dl-search" placeholder="Search components and tokens" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </form>
          <button
            type="button"
            className="dl-toggle"
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            disabled={!canDark}
            title={canDark ? "Toggle light/dark" : "The theme has no dark colour scheme"}
            data-testid="mode-toggle"
          >
            {mode === "dark" ? "☾ Dark" : "☀ Light"}
          </button>
        </header>
        <main className="dl-content">{children}</main>
      </div>
    </div>
  );
}
