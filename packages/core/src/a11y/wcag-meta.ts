/**
 * WCAG 2.2 + WAI-ARIA APG metadata — data-independent, shared by every
 * target so a component entry only needs to say `sc: "2.1.1"` or
 * `pattern: "dialog-modal"`.
 *
 * Only the success criteria that can be judged at COMPONENT level are
 * listed (page-level ones like 2.4.1 Bypass Blocks or 3.1.1 Language of
 * Page belong to the app, not a card). Links go to the W3C
 * "Understanding" pages, which explain intent + how to test.
 */

export type WcagLevel = "A" | "AA" | "AAA"
export type WcagPrinciple = "Perceivable" | "Operable" | "Understandable" | "Robust"

export type WcagCriterion = {
  sc: string
  name: string
  level: WcagLevel
  principle: WcagPrinciple
  href: string
}

const U = "https://www.w3.org/WAI/WCAG22/Understanding"

function c(sc: string, name: string, level: WcagLevel, slug: string): [string, WcagCriterion] {
  const principle: WcagPrinciple =
    sc.startsWith("1.") ? "Perceivable" : sc.startsWith("2.") ? "Operable" : sc.startsWith("3.") ? "Understandable" : "Robust"
  return [sc, { sc, name, level, principle, href: `${U}/${slug}` }]
}

export const WCAG: Record<string, WcagCriterion> = Object.fromEntries([
  c("1.1.1", "Non-text Content", "A", "non-text-content"),
  c("1.3.1", "Info and Relationships", "A", "info-and-relationships"),
  c("1.3.5", "Identify Input Purpose", "AA", "identify-input-purpose"),
  c("1.4.1", "Use of Color", "A", "use-of-color"),
  c("1.4.3", "Contrast (Minimum)", "AA", "contrast-minimum"),
  c("1.4.6", "Contrast (Enhanced)", "AAA", "contrast-enhanced"),
  c("1.4.11", "Non-text Contrast", "AA", "non-text-contrast"),
  c("1.4.12", "Text Spacing", "AA", "text-spacing"),
  c("1.4.13", "Content on Hover or Focus", "AA", "content-on-hover-or-focus"),
  c("2.1.1", "Keyboard", "A", "keyboard"),
  c("2.1.2", "No Keyboard Trap", "A", "no-keyboard-trap"),
  c("2.1.4", "Character Key Shortcuts", "A", "character-key-shortcuts"),
  c("2.2.2", "Pause, Stop, Hide", "A", "pause-stop-hide"),
  c("2.3.3", "Animation from Interactions", "AAA", "animation-from-interactions"),
  c("2.4.3", "Focus Order", "A", "focus-order"),
  c("2.4.6", "Headings and Labels", "AA", "headings-and-labels"),
  c("2.4.7", "Focus Visible", "AA", "focus-visible"),
  c("2.4.11", "Focus Not Obscured (Minimum)", "AA", "focus-not-obscured-minimum"),
  c("2.4.13", "Focus Appearance", "AAA", "focus-appearance"),
  c("2.5.3", "Label in Name", "A", "label-in-name"),
  c("2.5.5", "Target Size (Enhanced)", "AAA", "target-size-enhanced"),
  c("2.5.7", "Dragging Movements", "AA", "dragging-movements"),
  c("2.5.8", "Target Size (Minimum)", "AA", "target-size-minimum"),
  c("3.2.1", "On Focus", "A", "on-focus"),
  c("3.2.2", "On Input", "A", "on-input"),
  c("3.3.1", "Error Identification", "A", "error-identification"),
  c("3.3.2", "Labels or Instructions", "A", "labels-or-instructions"),
  c("3.3.7", "Redundant Entry", "A", "redundant-entry"),
  c("4.1.2", "Name, Role, Value", "A", "name-role-value"),
  c("4.1.3", "Status Messages", "AA", "status-messages"),
])

export const WCAG_LEVELS: WcagLevel[] = ["A", "AA", "AAA"]

// WAI-ARIA Authoring Practices Guide patterns a component can claim.
const P = "https://www.w3.org/WAI/ARIA/apg/patterns"
export const APG = {
  "button": { name: "Button", href: `${P}/button/` },
  "checkbox": { name: "Checkbox", href: `${P}/checkbox/` },
  "combobox": { name: "Combobox", href: `${P}/combobox/` },
  "dialog-modal": { name: "Dialog (Modal)", href: `${P}/dialog-modal/` },
  "alertdialog": { name: "Alert Dialog", href: `${P}/alertdialog/` },
  "disclosure": { name: "Disclosure", href: `${P}/disclosure/` },
  "link": { name: "Link", href: `${P}/link/` },
  "listbox": { name: "Listbox", href: `${P}/listbox/` },
  "menu-button": { name: "Menu Button", href: `${P}/menu-button/` },
  "menu": { name: "Menu / Menu bar", href: `${P}/menubar/` },
  "radio-group": { name: "Radio Group", href: `${P}/radio/` },
  "slider": { name: "Slider", href: `${P}/slider/` },
  "slider-multithumb": { name: "Slider (Multi-Thumb)", href: `${P}/slider-multithumb/` },
  "switch": { name: "Switch", href: `${P}/switch/` },
  "tabs": { name: "Tabs", href: `${P}/tabs/` },
  "tooltip": { name: "Tooltip", href: `${P}/tooltip/` },
  "landmarks": { name: "Landmark Regions", href: `${P}/landmarks/` },
} as const
export type ApgPattern = keyof typeof APG
