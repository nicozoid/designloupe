import ts from "typescript";

export interface ImportBinding { local: string; imported: string; specifier: string; resolvedFile?: string }
export interface JsxUse { tag: string; line: number }
export interface ReExport { exported: string; imported: string; specifier: string; resolvedFile?: string }
export interface FileScan { file: string; imports: ImportBinding[]; jsx: JsxUse[]; styledTargets: string[]; exports: string[]; reExports: ReExport[] }

const scriptKind = (file: string) =>
  file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : file.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS;

export function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
}

function rootIdentifier(name: ts.JsxTagNameExpression): string | undefined {
  let n: ts.Node = name;
  while (ts.isPropertyAccessExpression(n)) n = n.expression;
  return ts.isIdentifier(n) ? n.text : undefined;
}

export function scanSource(
  file: string,
  text: string,
  resolve?: (specifier: string, fromFile: string) => string | undefined,
): FileScan {
  const sf = parse(file, text);
  const out: FileScan = { file, imports: [], jsx: [], styledTargets: [], exports: [], reExports: [] };
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const specifier = stmt.moduleSpecifier.text;
      const resolvedFile = resolve?.(specifier, file);
      const add = (local: string, imported: string) =>
        out.imports.push(resolvedFile ? { local, imported, specifier, resolvedFile } : { local, imported, specifier });
      const clause = stmt.importClause;
      if (!clause) continue;
      if (clause.name) add(clause.name.text, "default");
      const nb = clause.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) add(nb.name.text, "*");
      if (nb && ts.isNamedImports(nb))
        for (const el of nb.elements) add(el.name.text, (el.propertyName ?? el.name).text);
    }
    // exports
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const isExported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isExported && isDefault) out.exports.push("default");
    else if (isExported && (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && stmt.name) out.exports.push(stmt.name.text);
    else if (isExported && ts.isVariableStatement(stmt))
      for (const d of stmt.declarationList.declarations) if (ts.isIdentifier(d.name)) out.exports.push(d.name.text);
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) out.exports.push("default");
    if (ts.isExportDeclaration(stmt)) {
      const spec = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : undefined;
      const resolvedFile = spec ? resolve?.(spec, file) : undefined;
      const addRe = (exported: string, imported: string) =>
        out.reExports.push(resolvedFile ? { exported, imported, specifier: spec!, resolvedFile } : { exported, imported, specifier: spec! });
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          out.exports.push(el.name.text);
          if (spec) addRe(el.name.text, (el.propertyName ?? el.name).text);
        }
      } else if (!stmt.exportClause && spec) addRe("*", "*");
    }
  }

  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = rootIdentifier(n.tagName);
      // Lower-case tags are intrinsic DOM elements.
      if (tag && /^[A-Z]/.test(tag)) out.jsx.push({ tag, line: lineOf(n) });
    }
    // styled(X)(…) / styled(X, opts)
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "styled") {
      const first = n.arguments[0];
      if (first && ts.isIdentifier(first)) out.styledTargets.push(first.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
