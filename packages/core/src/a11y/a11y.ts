/**
 * Accessibility helpers for the component "Accessibility" section.
 *
 * Pure data-in / data-out — no React, no DOM — so it's unit-testable and
 * app-agnostic. The card supplies `resolveVar` (live token → hex) and
 * this file does the judging:
 *
 *   resolveWcag()  — attach WCAG 2.2 metadata to each authored check,
 *                    compute contrast for `measure` rows against the
 *                    threshold for (kind, level), sort for reading.
 *   rollupWcag()   — per-level pass/total counts + the AA verdict.
 *   contrastRatio()/compositeHex() — WCAG 2.x relative-luminance maths,
 *                    with alpha composited in sRGB the way browsers do.
 */

import type { ContrastMeasure, WcagCheck, WcagStatus } from "./types"
import { WCAG, WCAG_LEVELS } from "./wcag-meta"
import type { WcagLevel } from "./wcag-meta"

// ── Colour maths ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex2(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")
}

// Blend `fg` at `alpha` over an opaque `bg`, per channel in sRGB. This is
// what the compositor does for `bg-x/50`, so measuring the blended colour
// matches what the eye actually sees.
export function compositeHex(fg: string, alpha: number, bg: string): string {
  const f = hexToRgb(fg), b = hexToRgb(bg)
  if (!f || !b) return ""
  const a = Math.min(1, Math.max(0, alpha))
  const mix = (i: number) => a * f[i] + (1 - a) * b[i]
  return `#${toHex2(mix(0))}${toHex2(mix(1))}${toHex2(mix(2))}`
}

// Flatten a translucent colour (8-digit hex from toHex) over an opaque bg so
// contrast is measured on what's painted. 6-digit input passes through.
export function flattenOver(fg: string, bg: string): string {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(fg.trim())
  if (!m) return fg
  return compositeHex(`#${m[1]}`, parseInt(m[2]!, 16) / 255, bg)
}

// WCAG 2.x relative luminance (sRGB → linear, weighted).
function luminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const lin = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

// Contrast ratio (1–21), order-independent. Returns NaN for bad input.
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b)
  if (la === null || lb === null) return NaN
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  const r = (hi + 0.05) / (lo + 0.05)
  // Round to 2dp so #000/#fff is exactly 21 and tests are stable.
  return Math.round(r * 100) / 100
}

// Minimum ratio for a pair, by what the pair is and the level being
// claimed. 1.4.11 (ui) has no AAA tier, so AAA falls back to 3.
export function thresholdFor(kind: ContrastMeasure["kind"], level: WcagLevel): number {
  if (kind === "text") return level === "AAA" ? 7 : 4.5
  if (kind === "large-text") return level === "AAA" ? 4.5 : 3
  return 3
}

// ── Resolution ───────────────────────────────────────────────────────

export type WcagRow = {
  sc: string
  name: string
  level: WcagLevel
  href?: string
  catalogued: boolean
  status?: WcagStatus          // undefined = measured but tokens not resolved yet
  evidence?: string
  measured?: {
    kind: ContrastMeasure["kind"]
    label?: string
    fg: string                  // token names, for display
    bg: string
    ratio?: number              // undefined until resolved
    threshold: number
    fgHex?: string              // the composited colours actually compared
    bgHex?: string
  }
}

// Rank for sorting within a level: failures first so the reader sees
// what's wrong, then partials, then passes.
const STATUS_RANK: Record<WcagStatus, number> = { fail: 0, partial: 1, pass: 2, inherited: 2 }

function scParts(sc: string): number[] {
  return sc.split(".").map((n) => parseInt(n, 10) || 0)
}
function compareSc(a: string, b: string): number {
  const pa = scParts(a), pb = scParts(b)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

export function resolveWcag(
  checks: WcagCheck[],
  resolveVar: (path: string) => string, // token path → hex
): WcagRow[] {
  const rows: WcagRow[] = checks.map((check) => {
    const meta = WCAG[check.sc]
    const base: WcagRow = meta
      ? { sc: check.sc, name: meta.name, level: meta.level, href: meta.href, catalogued: true }
      : { sc: check.sc, name: "Unknown criterion", level: "A", catalogued: false }

    if (check.measure) {
      const m = check.measure
      const threshold = thresholdFor(m.kind, base.level)
      const measured: NonNullable<WcagRow["measured"]> = {
        kind: m.kind, label: m.label, fg: m.fg, bg: m.bg, threshold,
      }
      const over = resolveVar(m.over ?? "palette.background.default")
      const bgRaw = resolveVar(m.bg)
      const fgRaw = resolveVar(m.fg)
      if (fgRaw && bgRaw) {
        // Composite a translucent bg over the page, then fg over that.
        const bgHex = m.bgAlpha !== undefined && over ? compositeHex(bgRaw, m.bgAlpha, over) : bgRaw
        const fgHex = m.fgAlpha !== undefined ? compositeHex(fgRaw, m.fgAlpha, bgHex) : fgRaw
        const ratio = contrastRatio(fgHex, bgHex)
        if (!Number.isNaN(ratio)) {
          measured.ratio = ratio
          measured.fgHex = fgHex
          measured.bgHex = bgHex
          base.status = ratio >= threshold ? "pass" : "fail"
        }
      }
      return { ...base, measured, evidence: check.evidence }
    }
    return { ...base, status: check.status, evidence: check.evidence }
  })

  return rows.sort((a, b) => {
    const la = WCAG_LEVELS.indexOf(a.level), lb = WCAG_LEVELS.indexOf(b.level)
    if (la !== lb) return la - lb
    const ra = a.status ? STATUS_RANK[a.status] : 3, rb = b.status ? STATUS_RANK[b.status] : 3
    if (ra !== rb) return ra - rb
    return compareSc(a.sc, b.sc)
  })
}

// ── Roll-up ──────────────────────────────────────────────────────────

export type WcagVerdict = "meets-aa" | "partial-aa" | "fails-aa" | "unknown"

export type WcagRollup = {
  byLevel: Record<WcagLevel, { pass: number; total: number }>
  verdict: WcagVerdict
}

// pass + inherited count as met. Pending (unresolved) rows are excluded
// from totals so SSR / first paint doesn't report a fail. The verdict
// looks at A + AA only — AAA is aspirational and never fails "AA".
export function rollupWcag(rows: WcagRow[]): WcagRollup {
  const byLevel: WcagRollup["byLevel"] = { A: { pass: 0, total: 0 }, AA: { pass: 0, total: 0 }, AAA: { pass: 0, total: 0 } }
  let anyFail = false, anyPartial = false, anyJudged = false
  for (const r of rows) {
    if (!r.status || !r.catalogued) continue
    const bucket = byLevel[r.level]
    bucket.total += 1
    const met = r.status === "pass" || r.status === "inherited"
    if (met) bucket.pass += 1
    if (r.level !== "AAA") {
      anyJudged = true
      if (r.status === "fail") anyFail = true
      if (r.status === "partial") anyPartial = true
    }
  }
  const verdict: WcagVerdict = !anyJudged ? "unknown" : anyFail ? "fails-aa" : anyPartial ? "partial-aa" : "meets-aa"
  return { byLevel, verdict }
}
