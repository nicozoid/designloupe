import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import model from "virtual:loupe/model";
import adapter from "virtual:loupe/adapter";
import { loadTheme } from "virtual:loupe/theme";
import { loadWrapper } from "virtual:loupe/wrapper";
import { componentDocs, loadAnomalies, loadTokenNotes } from "virtual:loupe/loupe-files";
import type { AdapterBrowser, Anomaly, ComponentDocInput, DiscoveryModel, Mode, OverrideEntry, TokenModel, TokenNotes } from "@designloupe/core";
import { checkAnomalies, collectDocs } from "./docs";

export interface LoupeState {
  model: DiscoveryModel;
  adapter: AdapterBrowser;
  theme: unknown | null;
  themeError?: string;
  wrapperError?: string;
  tokens: TokenModel | null;
  overrides: OverrideEntry[];
  docs: Map<string, ComponentDocInput>;
  docErrors: string[];
  authoredAnomalies: Anomaly[];
  tokenNotes: TokenNotes;
  mode: Mode;
  setMode(m: Mode): void;
  canDark: boolean;
  failures: Record<string, string>;
  reportFailure(id: string, message: string): void;
  /** The wrapper loaded but threw while rendering: shown on the Overview like a load failure. */
  reportWrapperError(message: string): void;
  Wrapper: ComponentType<{ children: ReactNode }> | null;
}

const Ctx = createContext<LoupeState | null>(null);
export const useLoupe = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useLoupe outside LoupeProvider");
  return s;
};

const MODE_KEY = "designloupe:mode";
const readMode = (): Mode => {
  try {
    return localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Match a loupe file's `component` ("src/x.tsx" or "src/x.tsx#Name") to discovered component ids. */
function idsFor(component: string): string[] {
  const [file, exp] = component.split("#");
  return model.components.filter((c) => c.file === file && (!exp || c.exportName === exp || c.name === exp)).map((c) => c.id);
}

type Loaded = Omit<LoupeState, "mode" | "setMode" | "failures" | "reportFailure" | "reportWrapperError" | "canDark">;

async function loadAll(): Promise<Loaded> {
  const out: Loaded = {
    model, adapter, theme: null, tokens: null, overrides: [], docs: new Map(), docErrors: [],
    authoredAnomalies: [], tokenNotes: {}, Wrapper: null,
  };
  if (loadTheme) {
    try {
      const t = await loadTheme();
      if (!adapter.isTheme(t)) throw new Error(`The themeEntry export is not a ${adapter.libraryName} theme.`);
      out.theme = t;
      out.tokens = adapter.readTokens(t);
      out.overrides = adapter.readOverrides(t);
    } catch (e) {
      out.themeError = msg(e);
    }
  }
  if (loadWrapper) {
    try {
      out.Wrapper = await loadWrapper();
    } catch (e) {
      out.wrapperError = msg(e);
    }
  }
  const settled = await Promise.allSettled(componentDocs.map((f) => f()));
  const { docs, docErrors } = collectDocs(settled, idsFor);
  out.docs = docs;
  out.docErrors.push(...docErrors);
  try {
    if (loadAnomalies) {
      const { anomalies, errors } = checkAnomalies(await loadAnomalies());
      out.authoredAnomalies = anomalies;
      out.docErrors.push(...errors);
    }
  } catch (e) {
    out.docErrors.push(`anomalies file: ${msg(e)}`);
  }
  try {
    out.tokenNotes = (await loadTokenNotes?.()) ?? {};
  } catch (e) {
    out.docErrors.push(`tokens file: ${msg(e)}`);
  }
  return out;
}

export function LoupeProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setModeState] = useState<Mode>(readMode);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [wrapperRenderError, setWrapperRenderError] = useState<string>();

  useEffect(() => {
    loadAll().then(setLoaded).catch((e) =>
      setLoaded({
        model, adapter, theme: null, tokens: null, overrides: [], docs: new Map(), docErrors: [`Loading failed: ${msg(e)}`],
        authoredAnomalies: [], tokenNotes: {}, Wrapper: null,
      }),
    );
  }, []);

  const canDark = !!loaded?.theme && adapter.hasDarkScheme(loaded.theme);
  const effectiveMode: Mode = canDark ? mode : "light";

  useEffect(() => {
    document.documentElement.dataset.dlMode = effectiveMode;
  }, [effectiveMode]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* private mode */
    }
  }, []);

  const reportFailure = useCallback((id: string, message: string) => {
    setFailures((f) => (f[id] === message ? f : { ...f, [id]: message }));
  }, []);

  const reportWrapperError = useCallback((message: string) => setWrapperRenderError(`Rendering failed: ${message}`), []);

  const value = useMemo<LoupeState | null>(
    () =>
      loaded
        ? {
            ...loaded,
            wrapperError: loaded.wrapperError ?? wrapperRenderError,
            mode: effectiveMode, setMode, canDark, failures, reportFailure, reportWrapperError,
          }
        : null,
    [loaded, wrapperRenderError, effectiveMode, setMode, canDark, failures, reportFailure, reportWrapperError],
  );

  if (!value) return <div className="dl-loading">Loading design system…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
