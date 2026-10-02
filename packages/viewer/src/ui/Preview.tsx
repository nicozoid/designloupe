import { Component, type ReactNode } from "react";
import { useLoupe } from "../state";
import { ErrorCard } from "./ErrorCard";

class Boundary extends Component<{ onError?: (m: string) => void; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error.message);
  }
  render() {
    return this.state.error ? <ErrorCard title="Render failed" message={this.state.error.message} /> : this.props.children;
  }
}

/** A stage that renders target code under the target theme, isolated by an error boundary. */
export function Preview({ id, children, plain }: { id?: string; children: ReactNode; plain?: boolean }) {
  const { adapter, reportFailure } = useLoupe();
  const Frame = adapter.PreviewFrame;
  return (
    <div className="dl-stage">
      <Boundary onError={id ? (m) => reportFailure(id, `render: ${m}`) : undefined}>
        {plain ? children : <Frame>{children}</Frame>}
      </Boundary>
    </div>
  );
}

export { Boundary };
