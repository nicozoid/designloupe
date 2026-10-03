import { test, expect } from "@playwright/test";

/** One failure never takes down the viewer: it stays inside the page (or card) that hit it. */

test("a module that fails to load breaks only its own page", async ({ page }) => {
  // Stand-in for e.g. an icon import Vite can't resolve: virtual:loupe/icons itself throws.
  await page.route(/virtual:loupe\/icons/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: 'throw new Error("icons module boom");\nexport default {};' }),
  );
  await page.goto("/#/icons");
  await expect(page.locator(".dl-error", { hasText: "icons module boom" })).toBeVisible();
  // The rest of the viewer still works.
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "MUI fixture" })).toBeVisible();
});

test("a page that throws while rendering shows an error card, and other pages recover", async ({ page }) => {
  // The Colour page reads each token's note while rendering: serve a token-notes file whose note throws.
  await page.route(/fixture-loupe\/tokens\.ts/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export default { get "palette.primary.main"() { throw new Error("page render boom"); } };',
    }),
  );
  await page.goto("/#/tokens/colour");
  await expect(page.locator(".dl-error", { hasText: "page render boom" })).toBeVisible();
  await expect(page.locator(".dl-sidebar")).toBeVisible();
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "MUI fixture" })).toBeVisible();
});

test("authored anomalies with an unknown category or status are dropped and reported", async ({ page }) => {
  await page.route(/fixture-loupe\/anomalies\.ts/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export default [
        { id: "zz01", title: "Typo category", category: "colour", status: "open", description: "d", locations: [] },
        { id: "zz02", title: "No locations", category: "color", status: "open", description: "d" },
        { id: "zz03", title: "Fine one", category: "color", status: "todo", description: "d", locations: ["src/a.tsx"] },
      ];`,
    }),
  );
  await page.goto("/#/anomalies");
  await expect(page.getByText("Fine one")).toBeVisible();
  await expect(page.getByText("Typo category")).toHaveCount(0);
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.locator(".dl-error", { hasText: /zz01.*category/ })).toBeVisible();
  await expect(page.locator(".dl-error", { hasText: /zz02.*locations/ })).toBeVisible();
});

test("a malformed % escape in the hash doesn't crash the viewer", async ({ page }) => {
  await page.goto("/#/search/100%");
  await expect(page.getByRole("heading", { level: 1, name: /Search: .100%/ })).toBeVisible();
});

test("a wrapper that throws while rendering is reported on the overview", async ({ page }) => {
  await page.route(/fixture-loupe\/Wrapper\.tsx/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: 'export default function Wrapper() { throw new Error("wrapper render boom"); }' }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "MUI fixture" })).toBeVisible();
  await expect(page.locator(".dl-error", { hasText: "wrapper render boom" })).toBeVisible();
});

test("toHex returns an empty string for colours the canvas rejects", async ({ page }) => {
  await page.goto("/");
  const out = await page.evaluate(async () => {
    const { toHex } = await import(/* @vite-ignore */ "/src/ui/colour.ts" as string);
    return [toHex("#ff0000"), toHex("not-a-colour"), toHex("#000")];
  });
  expect(out).toEqual(["#ff0000", "", "#000000"]);
});
