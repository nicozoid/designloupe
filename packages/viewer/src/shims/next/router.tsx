import type { ComponentType } from "react";

/** Loupe shim for next/router (Pages Router). */
const router = {
  pathname: "/", route: "/", asPath: "/", query: {}, basePath: "", isReady: true, isFallback: false,
  push: async () => true, replace: async () => true, reload() {}, back() {}, prefetch: async () => {},
  events: { on() {}, off() {}, emit() {} },
};
export const useRouter = () => router;
export function withRouter<P>(C: ComponentType<P & { router: typeof router }>) {
  return (props: P) => <C {...props} router={router} />;
}
export default router;
