import { Component, lazy, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { useLoupe } from "./state";
import { useRoute } from "./router";
import { Shell } from "./shell/Shell";
import { NotFound } from "./pages/NotFound";
import { ErrorCard } from "./ui/ErrorCard";

/**
 * Pages load lazily, so a module that fails to load (e.g. a virtual:loupe/* module Vite can't build) takes
 * down only the page that imports it, via PageBoundary, not the whole viewer.
 */
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

/** Page registry. Later tasks add entries here. */
export const PAGES: Record<string, ComponentType> = {
  "": page(() => import("./pages/Overview"), "Overview"),
  "tokens/colour": page(() => import("./pages/Colour"), "Colour"),
  "tokens/typography": page(() => import("./pages/Typography"), "TypographyPage"),
  "tokens/layout": page(() => import("./pages/Layout"), "Layout"),
  "tokens/elevation": page(() => import("./pages/Elevation"), "Elevation"),
  "tokens/motion": page(() => import("./pages/Motion"), "Motion"),
  overrides: page(() => import("./pages/Overrides"), "Overrides"),
  components: page(() => import("./pages/Components"), "Components"),
  library: page(() => import("./pages/LibraryUsage"), "LibraryUsage"),
  icons: page(() => import("./pages/Icons"), "Icons"),
  anomalies: page(() => import("./pages/Anomalies"), "Anomalies"),
  search: page(() => import("./pages/Search"), "Search"),
};

function pageKey(segments: string[]): string {
  const clean = segments.map((s) => s.split("#")[0]!);
  if (clean[0] === "tokens") return clean.slice(0, 2).join("/");
  return clean[0] ?? "";
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A page that throws (while loading or rendering) shows an error card; the shell and other pages keep working. */
class PageBoundary extends Component<{ route: string; children: ReactNode }, { error: unknown; route: string; failed: boolean }> {
  state = { error: null as unknown, route: this.props.route, failed: false };
  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }
  static getDerivedStateFromProps(props: { route: string }, state: { route: string }) {
    // Moving within the same page (another component, another search) gets a fresh try.
    return props.route === state.route ? null : { error: null, failed: false, route: props.route };
  }
  render() {
    return this.state.failed ? <ErrorCard title="This page failed" message={message(this.state.error)} /> : this.props.children;
  }
}

/** If the user's wrapper throws, keep the viewer usable without it, and say so on the Overview. */
class WrapperBoundary extends Component<{ fallback: ReactNode; onError(message: string): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown, _info: ErrorInfo) {
    this.props.onError(message(error));
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function App() {
  const { adapter, theme, mode, Wrapper, reportWrapperError } = useLoupe();
  const { segments } = useRoute();
  const key = pageKey(segments);
  const Page = PAGES[key] ?? NotFound;
  const shell = (
    <Shell>
      <PageBoundary key={key} route={segments.join("/")}>
        <Suspense fallback={<div className="dl-loading">Loading…</div>}>
          <Page />
        </Suspense>
      </PageBoundary>
    </Shell>
  );
  const wrapped = Wrapper ? <WrapperBoundary fallback={shell} onError={reportWrapperError}><Wrapper>{shell}</Wrapper></WrapperBoundary> : shell;
  if (!theme) return wrapped;
  const Root = adapter.PreviewRoot;
  return <Root theme={theme} mode={mode}>{wrapped}</Root>;
}
