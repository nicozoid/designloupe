import { test, expect } from "vitest"
import { contrastRatio, compositeHex, flattenOver, resolveWcag, rollupWcag, thresholdFor } from "./a11y"
import type { WcagCheck } from "./types"

test("contrastRatio matches WCAG reference values", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBe(21)
  expect(contrastRatio("#ffffff", "#000000")).toBe(21)
  expect(contrastRatio("#777777", "#ffffff").toFixed(2)).toBe("4.48")
  expect(contrastRatio("#ffffff", "#ffffff")).toBe(1)
})

test("compositeHex blends fg over bg in sRGB like the browser", () => {
  expect(compositeHex("#000000", 0.5, "#ffffff")).toBe("#808080")
  expect(compositeHex("#ff0000", 1, "#ffffff")).toBe("#ff0000")
  expect(compositeHex("#ff0000", 0, "#ffffff")).toBe("#ffffff")
})

test("flattenOver composites 8-digit hex alpha over an opaque bg", () => {
  expect(flattenOver("#00000080", "#ffffff")).toBe("#7f7f7f")
  expect(flattenOver("#123456", "#ffffff")).toBe("#123456")
  expect(flattenOver("#000000ff", "#ffffff")).toBe("#000000")
})

test("thresholds follow kind + level", () => {
  expect(thresholdFor("text", "AA")).toBe(4.5)
  expect(thresholdFor("text", "AAA")).toBe(7)
  expect(thresholdFor("large-text", "AA")).toBe(3)
  expect(thresholdFor("large-text", "AAA")).toBe(4.5)
  expect(thresholdFor("ui", "AA")).toBe(3)
  expect(thresholdFor("ui", "AAA")).toBe(3)
})

const vars: Record<string, string> = {
  "palette.primary.main": "#2f6544",
  "palette.primary.contrastText": "#f7f4ec",
  "palette.background.default": "#f2efe6",
  "palette.action.focus": "#c4dcbb",
}
const resolve = (v: string) => vars[v] ?? ""

test("resolveWcag attaches meta, judges measured rows live, keeps authored ones", () => {
  const checks: WcagCheck[] = [
    { sc: "2.1.1", status: "pass", evidence: "Native button." },
    { sc: "1.4.3", measure: { fg: "palette.primary.contrastText", bg: "palette.primary.main", kind: "text" } },
    { sc: "1.4.11", measure: { fg: "palette.action.focus", bg: "palette.background.default", kind: "ui", fgAlpha: 0.5, label: "focus ring" } },
    { sc: "4.1.2", status: "inherited", evidence: "MUI." },
  ]
  const rows = resolveWcag(checks, resolve)
  const by = Object.fromEntries(rows.map((r) => [r.sc, r]))
  expect(by["2.1.1"].name).toBe("Keyboard")
  expect(by["2.1.1"].level).toBe("A")
  expect(by["2.1.1"].status).toBe("pass")
  expect(by["2.1.1"].href).toBe("https://www.w3.org/WAI/WCAG22/Understanding/keyboard")
  // Measured: 1.4.3 primary-foreground on primary is well over 4.5.
  expect(by["1.4.3"].measured?.kind).toBe("text")
  expect(by["1.4.3"]!.measured!.ratio! > 4.5).toBeTruthy()
  expect(by["1.4.3"].status).toBe("pass")
  expect(by["1.4.3"].measured!.threshold).toBe(4.5)
  // Measured: ring at 50% over background is far under 3.
  expect(by["1.4.11"]!.measured!.ratio! < 3).toBeTruthy()
  expect(by["1.4.11"].status).toBe("fail")
  expect(by["1.4.11"].measured!.label).toBe("focus ring")
  expect(by["4.1.2"].status).toBe("inherited")
})

test("measured rows are pending (no status) until the tokens resolve", () => {
  const [row] = resolveWcag([{ sc: "1.4.3", measure: { fg: "palette.nope", bg: "palette.primary.main", kind: "text" } }], resolve)
  expect(row.status).toBe(undefined)
  expect(row.measured?.ratio).toBe(undefined)
})

test("unknown criteria are flagged rather than dropped", () => {
  const [row] = resolveWcag([{ sc: "9.9.9", status: "pass", evidence: "?" }], resolve)
  expect(row.catalogued).toBe(false)
  expect(row.name).toBe("Unknown criterion")
})

test("rows sort by level then failures first then sc number", () => {
  const rows = resolveWcag(
    [
      { sc: "4.1.2", status: "pass", evidence: "" },
      { sc: "2.4.7", status: "partial", evidence: "" },
      { sc: "2.1.1", status: "pass", evidence: "" },
      { sc: "2.5.5", status: "fail", evidence: "" },
      { sc: "1.4.11", status: "fail", evidence: "" },
    ],
    resolve,
  )
  expect(rows.map((r) => r.sc)).toEqual(["2.1.1", "4.1.2", "1.4.11", "2.4.7", "2.5.5"])
})

test("rollupWcag counts per level and derives the AA verdict", () => {
  const rows = resolveWcag(
    [
      { sc: "2.1.1", status: "pass", evidence: "" },
      { sc: "4.1.2", status: "inherited", evidence: "" },
      { sc: "2.4.7", status: "pass", evidence: "" },
      { sc: "2.5.8", status: "pass", evidence: "" },
      { sc: "2.5.5", status: "fail", evidence: "" },
    ],
    resolve,
  )
  const r = rollupWcag(rows)
  expect(r.byLevel.A).toEqual({ pass: 2, total: 2 })
  expect(r.byLevel.AA).toEqual({ pass: 2, total: 2 })
  expect(r.byLevel.AAA).toEqual({ pass: 0, total: 1 })
  expect(r.verdict).toBe("meets-aa") // AAA fails don't affect the AA verdict
})

test("verdict is partial-aa on partials, fails-aa on any A/AA fail; pending rows are excluded", () => {
  const mk = (s: "pass" | "partial" | "fail") => resolveWcag([{ sc: "2.4.7", status: s, evidence: "" }], resolve)
  expect(rollupWcag(mk("partial")).verdict).toBe("partial-aa")
  expect(rollupWcag(mk("fail")).verdict).toBe("fails-aa")
  const pending = resolveWcag([{ sc: "1.4.3", measure: { fg: "palette.nope", bg: "palette.primary.main", kind: "text" } }], resolve)
  expect(rollupWcag(pending).byLevel.AA).toEqual({ pass: 0, total: 0 })
  expect(rollupWcag([]).verdict).toBe("unknown")
})
