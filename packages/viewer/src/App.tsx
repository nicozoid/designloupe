import { Component, type ComponentType, type ReactNode } from "react";
import { useLoupe } from "./state";
import { useRoute } from "./router";
import { Shell } from "./shell/Shell";
import { Overview } from "./pages/Overview";
import { NotFound } from "./pages/NotFound";

/** Page registry. Later tasks add entries here. */
export const PAGES: Record<string, ComponentType> = {
  "": Overview,
};

function pageKey(segments: string[]): string {
  if (segments[0] === "tokens") return segments.slice(0, 2).join("/");
  return segments[0] ?? "";
}

/** If the user's wrapper throws, keep the viewer usable without it. */
class WrapperBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function App() {
  const { adapter, theme, mode, Wrapper } = useLoupe();
  const { segments } = useRoute();
  const Page = PAGES[pageKey(segments)] ?? NotFound;
  const shell = (
    <Shell>
      <Page />
    </Shell>
  );
  const wrapped = Wrapper ? <WrapperBoundary fallback={shell}><Wrapper>{shell}</Wrapper></WrapperBoundary> : shell;
  if (!theme) return wrapped;
  const Root = adapter.PreviewRoot;
  return <Root theme={theme} mode={mode}>{wrapped}</Root>;
}
