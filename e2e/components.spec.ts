import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("components index lists tier groups", async ({ page }) => {
  await page.goto("/#/components");
  await expect(page.locator(".dl-tile", { hasText: "Atoms" })).toContainText("1");
  await expect(page.locator(".dl-tile", { hasText: "Molecules" })).toContainText("1");
  await expect(page.locator(".dl-tile", { hasText: "Unsorted" })).toContainText("7");
});

test("atom page: PrimaryButton with loupe demo, props, usage, overrides link and a11y", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/components/atom/PrimaryButton");
  const s = page.locator("#c-PrimaryButton");
  await expect(s).toContainText("wraps MUI Button");
  await expect(s).toContainText("src/components/PrimaryButton.tsx");
  await expect(s).toContainText("Use for the single main action");
  await expect(s.getByRole("button", { name: "Upgrade" })).toBeVisible(); // loupe-file demo
  await s.locator("summary", { hasText: /^Props/ }).click();
  await expect(s).toContainText("tone");
  await expect(s).toContainText("inherited from MUI Button");
  await s.locator("summary", { hasText: "Used in" }).click();
  await expect(s).toContainText("src/features/Settings.tsx");
  await s.locator("summary", { hasText: "Theme overrides that apply" }).click();
  await expect(s.locator("a[href*='overrides']")).toBeVisible();
  await s.locator("summary", { hasText: "Accessibility" }).click();
  await expect(s).toContainText("Keyboard");
  await expect(s).toContainText("brand label on fill");
  expect(errors).toEqual([]);
});

test("unsorted: auto-demos, needs-demo, error isolation, and context-needing components render via wrapper", async ({ page }) => {
  await page.goto("/#/components/unsorted");
  // auto demo grid for StatusPill (enum axis status)
  await expect(page.locator("#c-StatusPill .dl-demo-cell")).toHaveCount(3);
  // TextInput: required label filled automatically (type is an own enum axis, so there are 3 cells)
  await expect(page.locator("#c-TextInput").getByLabel("TextInput").first()).toBeVisible();
  // NavLinkButton needs a router, EmptyState needs i18n: both render because the wrapper provides them
  await expect(page.locator("#c-EmptyState")).toContainText("Nothing here yet");
  await expect(page.locator("#c-NavLinkButton").getByRole("button", { name: "NavLinkButton", exact: true })).toBeVisible();
  // DocsLink renders through the next/link shim
  await expect(page.locator("#c-DocsLink a")).toBeVisible();
  // Broken is isolated
  await expect(page.locator("#c-Broken .dl-error")).toContainText("Broken on purpose");
  await expect(page.locator("#c-SparkIcon svg")).toBeVisible();
});
