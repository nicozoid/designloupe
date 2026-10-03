import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import * as docgen from "react-docgen-typescript";

export interface Analysis {
  resolve(specifier: string, fromFile: string): string | undefined;
  parseProps(files: string[]): docgen.ComponentDoc[];
}

const FALLBACK: ts.CompilerOptions = {
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  allowJs: true,
  esModuleInterop: true,
  skipLibCheck: true,
};

function readCompilerOptions(root: string, tsconfigPath: string): ts.CompilerOptions {
  if (!fs.existsSync(tsconfigPath)) return FALLBACK;
  const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (read.error) return FALLBACK;
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(tsconfigPath), undefined, tsconfigPath);
  return { ...FALLBACK, ...parsed.options, noEmit: true };
}

export function createAnalysis(root: string, tsconfigPath: string): Analysis {
  const options = readCompilerOptions(root, tsconfigPath);
  const host = ts.createCompilerHost(options);
  const cache = ts.createModuleResolutionCache(root, (f) => f, options);
  const SOURCE = /\.(tsx?|jsx?|mjs|cjs)$/;

  const NM = `${path.sep}node_modules${path.sep}`;
  const realpath = (f: string) => {
    try {
      return fs.realpathSync(f);
    } catch {
      return f;
    }
  };

  const resolve = (specifier: string, fromFile: string) => {
    const r = ts.resolveModuleName(specifier, fromFile, options, host, cache).resolvedModule;
    if (!r) return undefined;
    let f = path.resolve(r.resolvedFileName);
    // A package import is usually a library, except in a monorepo, where `@acme/ui` is a symlink to a workspace
    // package's source (packages/ui/src): that is the design system itself, so keep it, by its real path.
    if (r.isExternalLibraryImport || f.includes(NM)) {
      f = realpath(f);
      if (f.includes(NM)) return undefined;
    }
    if (f.endsWith(".d.ts") || !SOURCE.test(f)) return undefined;
    return f;
  };

  const parser = docgen.withCompilerOptions(options, {
    savePropValueAsString: true,
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    shouldIncludePropTagMap: false,
    skipChildrenPropWithoutDoc: false, // keep `children` even without a doc comment, so demos can fill it
    propFilter: () => true,
  });

  return { resolve, parseProps: (files) => parser.parse(files) };
}
