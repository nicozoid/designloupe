import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("MUI used directly lists raw usage with sites", async ({ page }) => {
  await page.goto("/#/library");
  for (const name of ["Button", "Chip", "Stack"]) await expect(page.locator("tr", { hasText: name }).first()).toBeVisible();
  await expect(page.locator("tr", { hasText: "Button" }).first()).toContainText("Theme overrides");
});

test("icons page renders library and custom icons", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/icons");
  await expect(page.locator(".dl-icon-tile", { hasText: "Delete" }).locator("svg")).toBeVisible();
  await expect(page.locator(".dl-icon-tile", { hasText: "SparkIcon" }).locator("svg")).toBeVisible();
  await expect(page.locator(".dl-icon-tile", { hasText: "Delete" })).toContainText('import DeleteIcon from "@mui/icons-material/Delete"');
  expect(errors).toEqual([]);
});

test("anomalies merge static, contrast, build and authored entries", async ({ page }) => {
  await page.goto("/#/anomalies");
  await expect(page.getByText("Hard-coded colour").first()).toBeVisible();
  await expect(page.getByText("Raw px spacing").first()).toBeVisible();
  await expect(page.getByText("Low contrast: warning text on main (light)")).toBeVisible();
  await expect(page.getByText("Two near-identical greens")).toBeVisible();
  // render failures appear after the component has been viewed
  await page.evaluate(() => (location.hash = "#/components/unsorted"));
  await expect(page.locator("#c-Broken .dl-error")).toBeVisible();
  await page.evaluate(() => (location.hash = "#/anomalies"));
  await expect(page.getByText("Broken failed to render")).toBeVisible();
  // status filter
  await page.getByRole("button", { name: /^Todo/ }).click();
  await expect(page.getByText("Two near-identical greens")).toBeVisible();
  await expect(page.getByText("Raw px spacing")).toHaveCount(0);
});

test("search finds components and tokens", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search").fill("brand");
  await page.getByLabel("Search").press("Enter");
  await expect(page).toHaveURL(/#\/search\/brand/);
  await expect(page.locator(".dl-search-results")).toContainText("palette.brand.main");
  await page.getByLabel("Search").fill("pill");
  await page.getByLabel("Search").press("Enter");
  await expect(page.locator(".dl-search-results a", { hasText: "StatusPill" })).toBeVisible();
});
