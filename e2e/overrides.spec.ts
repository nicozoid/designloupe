import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("overrides page lists customised components with code and before/after previews", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/overrides");
  const button = page.locator("#MuiButton");
  await expect(button).toContainText("disableElevation: true");
  await expect(button).toContainText('textTransform: "none"');
  await expect(button.getByText("Variant: dashed")).toBeVisible();
  // before/after: default theme keeps uppercase labels, the target theme doesn't
  const before = button.locator(".dl-before button").first();
  const after = button.locator(".dl-after button").first();
  await expect(before).toHaveCSS("text-transform", "uppercase");
  await expect(after).toHaveCSS("text-transform", "none");
  await expect(page.locator("#MuiCard")).toContainText('variant: "outlined"');
  expect(errors).toEqual([]);
});
