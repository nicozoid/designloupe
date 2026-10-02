/** Loupe shim for next/navigation (App Router hooks). */
const router = { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} };
export const useRouter = () => router;
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const useSelectedLayoutSegment = () => null;
export const useSelectedLayoutSegments = () => [];
export function redirect(url: string): never { throw new Error(`next/navigation redirect(${url}) called in Loupe`); }
export function notFound(): never { throw new Error("next/navigation notFound() called in Loupe"); }
