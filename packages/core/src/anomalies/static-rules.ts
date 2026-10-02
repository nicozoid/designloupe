import ts from "typescript";
import { parse } from "../analysis/scan-file";
import { anomalyCode } from "./codes";
import type { StaticFinding } from "../model";

const COLOUR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgb|rgba|hsl|hsla|oklch|lab)\(/i;
const PX = /(?:^|\s|-)\d+(?:\.\d+)?px\b/;
const SPACING = new Set([
  "m", "mt", "mr", "mb", "ml", "mx", "my", "p", "pt", "pr", "pb", "pl", "px", "py",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "marginInline", "marginBlock",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "paddingInline", "paddingBlock",
  "gap", "rowGap", "columnGap",
]);
const MESSAGES = {
  "colour-literal": "Hard-coded colour in styles; use a palette token.",
  "px-spacing": "Raw px spacing; use theme.spacing units.",
} as const;

const propName = (n: ts.PropertyName): string | undefined =>
  ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : undefined;

/** Is `n` a style context: sx={…}, style={…}, or the argument of styled(X)(…)? */
function isStyleRoot(n: ts.Node): boolean {
  if (ts.isJsxAttribute(n)) {
    const name = ts.isIdentifier(n.name) ? n.name.text : "";
    return name === "sx" || name === "style";
  }
  if (ts.isCallExpression(n) && ts.isCallExpression(n.expression)) {
    const inner = n.expression.expression;
    return ts.isIdentifier(inner) && inner.text === "styled";
  }
  return false;
}

export function findStaticIssues(relFile: string, text: string): StaticFinding[] {
  const sf = parse(relFile, text);
  const out: StaticFinding[] = [];
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const inspect = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      const key = propName(n.name);
      const value = n.initializer.text;
      if (key) {
        const snippet = `${key}: ${value}`;
        const push = (rule: StaticFinding["rule"]) =>
          out.push({ code: anomalyCode(rule, relFile, snippet), rule, file: relFile, line: lineOf(n), snippet, message: MESSAGES[rule] });
        if (COLOUR.test(value)) push("colour-literal");
        else if (SPACING.has(key) && PX.test(value)) push("px-spacing");
      }
    }
    ts.forEachChild(n, inspect);
  };

  const visit = (n: ts.Node) => {
    if (isStyleRoot(n)) {
      ts.forEachChild(n, inspect);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out.sort((a, b) => a.line - b.line);
}
