import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("colour page: both schemes, custom palette key, hex values, contrast verdicts", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/tokens/colour");
  await expect(page.getByRole("heading", { name: "Light scheme" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dark scheme" })).toBeVisible();
  await expect(page.locator("#light-brand")).toContainText("palette.brand.main");
  await expect(page.locator("#light-primary")).toContainText("#2f6544");
  const warning = page.locator("tr", { hasText: "warning text on main" }).first();
  await expect(warning).toContainText("Fails");
  const primary = page.locator("tr", { hasText: "primary text on main" }).first();
  await expect(primary).toContainText("AA");
  expect(errors).toEqual([]);
});

test("typography page renders each variant with measured metrics", async ({ page }) => {
  await page.goto("/#/tokens/typography");
  const eyebrow = page.locator("#eyebrow");
  await expect(eyebrow).toContainText('<Typography variant="eyebrow">');
  await expect(eyebrow).toContainText("letter-spacing");
  await expect(page.locator("#h1")).toContainText("40px"); // 2.5rem
});

test("layout, elevation and motion pages", async ({ page }) => {
  await page.goto("/#/tokens/layout");
  await expect(page.getByText("theme.spacing(2)")).toBeVisible();
  await expect(page.locator(".dl-spacing-row", { hasText: "theme.spacing(2)" })).toContainText("16px");
  await expect(page.locator(".dl-bp-seg")).toHaveCount(5);
  await expect(page.locator(".dl-bp-seg.is-current")).toHaveCount(1);
  await page.goto("/#/tokens/elevation");
  await expect(page.locator(".dl-shadow-tile")).toHaveCount(25);
  await page.goto("/#/tokens/motion");
  const short = page.locator("tr").filter({ has: page.locator("td", { hasText: /^short$/ }) });
  await expect(short).toContainText("250ms");
});
