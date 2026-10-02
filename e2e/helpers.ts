import type { Page } from "@playwright/test";

/** Collect page errors and console errors, ignoring the fixture's deliberate failures. */
export function trackErrors(page: Page, allow: RegExp[] = []) {
  const errors: string[] = [];
  const ok = (m: string) => [/Broken on purpose/, /The above error occurred/, /\[vite\]/, ...allow].some((r) => r.test(m));
  page.on("pageerror", (e) => !ok(e.message) && errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !ok(m.text()) && errors.push(m.text()));
  return errors;
}
