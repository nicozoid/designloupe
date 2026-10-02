import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("overview shows the target, counts and no warnings", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "MUI fixture" })).toBeVisible();
  const tile = (label: string) => page.locator(".dl-tile").filter({ has: page.locator(".dl-tile-label", { hasText: new RegExp(`^${label}$`) }) });
  await expect(tile("Components").locator(".dl-tile-value")).toHaveText("9");
  await expect(tile("Theme overrides").locator(".dl-tile-value")).toHaveText("3");
  await expect(page.getByText("Discovery warning")).toHaveCount(0);
  await expect(page.getByText("Theme failed to load")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mode toggle switches chrome and target colour scheme", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-dl-mode", "light");
  await page.getByTestId("mode-toggle").click();
  await expect(html).toHaveAttribute("data-dl-mode", "dark");
  await expect(html).toHaveClass(/dark/); // MUI colorSchemeSelector: "class"
});
