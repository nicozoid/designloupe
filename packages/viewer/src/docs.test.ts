import { it, expect } from "vitest";
import { collectDocs } from "./docs";

it("resolves matched docs and reports an error for one with no match", () => {
  const results: PromiseSettledResult<{ default?: { component: string } }>[] = [
    { status: "fulfilled", value: { default: { component: "src/x.tsx" } } },
  ];
  const { docs, docErrors } = collectDocs(results, (c) => (c === "src/x.tsx" ? ["id-1"] : []));
  expect(docs.get("id-1")).toEqual({ component: "src/x.tsx" });
  expect(docErrors).toEqual([]);
});

it("reports, instead of throwing, when a loupe module has no default export", () => {
  const results: PromiseSettledResult<{ default?: { component: string } }>[] = [
    { status: "fulfilled", value: {} },
  ];
  const { docs, docErrors } = collectDocs(results, () => ["id-1"]);
  expect(docs.size).toBe(0);
  expect(docErrors).toEqual(['Loupe file #1 has no default export from defineComponentDoc(...).']);
});

it("reports when the default export's component is not a string", () => {
  const results = [
    { status: "fulfilled", value: { default: { component: 123 } } },
  ] as unknown as PromiseSettledResult<{ default?: { component: string } }>[];
  const { docs, docErrors } = collectDocs(results, () => ["id-1"]);
  expect(docs.size).toBe(0);
  expect(docErrors).toEqual(['Loupe file #1 has no default export from defineComponentDoc(...).']);
});

it("reports a rejection without throwing", () => {
  const results: PromiseSettledResult<{ default?: { component: string } }>[] = [
    { status: "rejected", reason: new Error("boom") },
  ];
  const { docs, docErrors } = collectDocs(results, () => []);
  expect(docs.size).toBe(0);
  expect(docErrors).toEqual(["Loupe file #1: boom"]);
});

it("reports when the component matches no discovered component", () => {
  const results: PromiseSettledResult<{ default?: { component: string } }>[] = [
    { status: "fulfilled", value: { default: { component: "src/missing.tsx" } } },
  ];
  const { docs, docErrors } = collectDocs(results, () => []);
  expect(docs.size).toBe(0);
  expect(docErrors).toEqual(['Loupe file for "src/missing.tsx" matches no discovered component.']);
});
