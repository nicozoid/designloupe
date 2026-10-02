import { lazy, Suspense, type ComponentType } from "react";

type Loader = () => Promise<ComponentType<any> | { default: ComponentType<any> }>;

/** Loupe shim for next/dynamic: React.lazy + Suspense. */
export default function dynamic(loader: Loader, _opts?: unknown) {
  const L = lazy(async () => {
    const m = await loader();
    return { default: "default" in m ? m.default : m };
  });
  return (props: Record<string, unknown>) => (
    <Suspense fallback={null}>
      <L {...props} />
    </Suspense>
  );
}
