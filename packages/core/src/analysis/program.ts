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

  const resolve = (specifier: string, fromFile: string) => {
    const r = ts.resolveModuleName(specifier, fromFile, options, host, cache).resolvedModule;
    if (!r || r.isExternalLibraryImport) return undefined;
    const f = path.resolve(r.resolvedFileName);
    if (f.endsWith(".d.ts") || f.includes(`${path.sep}node_modules${path.sep}`) || !SOURCE.test(f)) return undefined;
    return f;
  };

  const parser = docgen.withCompilerOptions(options, {
    savePropValueAsString: true,
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    shouldIncludePropTagMap: false,
    propFilter: () => true,
  });

  return { resolve, parseProps: (files) => parser.parse(files) };
}
