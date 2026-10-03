import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { ResolvedConfig } from "../config/schema";
import type { AdapterNode } from "../adapter";
import type { CallSite, ComponentInfo, DiscoveryModel, IconInfo, LibraryUsage, StaticFinding } from "../model";
import { createAnalysis, type Analysis } from "../analysis/program";
import { scanSource, type FileScan } from "../analysis/scan-file";
import { findStaticIssues } from "../anomalies/static-rules";
import { toPropInfo } from "./props";
import { readPackageVersion } from "./package-version";

const posix = (p: string) => p.split(path.sep).join("/");

export interface DiscoverDeps {
  /** Override the TS analysis (resolve + parseProps). Defaults to `createAnalysis(root, tsconfig)`; a test seam. */
  analysis?: Analysis;
}

export async function discover(config: ResolvedConfig, adapter: AdapterNode, deps?: DiscoverDeps): Promise<DiscoveryModel> {
  const { root } = config;
  const rel = (abs: string) => posix(path.relative(root, abs));
  const warnings: string[] = [];
  const analysis = deps?.analysis ?? createAnalysis(root, config.tsconfig);
  const globOpts = { cwd: root, absolute: true, ignore: [...config.ignoreGlobs, "**/node_modules/**"] };
  const componentFiles = (await fg(config.componentGlobs, globOpts)).map((f) => path.resolve(f)).sort();
  const usageFiles = (await fg(config.usageGlobs, globOpts)).map((f) => path.resolve(f)).sort();
  const componentSet = new Set(componentFiles);
  const usageSet = new Set(usageFiles);
  if (!componentFiles.length) warnings.push(`No files matched componentGlobs (${config.componentGlobs.join(", ")}).`);
  if (!config.themeEntry) warnings.push("No themeEntry configured: token and override pages are disabled.");

  // ── scanning (lazy, cached; barrels outside the globs are scanned on demand) ──
  const scans = new Map<string, FileScan>();
  const getScan = (file: string): FileScan | undefined => {
    if (scans.has(file)) return scans.get(file);
    if (!fs.existsSync(file)) return undefined;
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (e) {
      warnings.push(`Could not read ${rel(file)}: ${(e as Error).message}`);
      return undefined;
    }
    const s = scanSource(file, text, analysis.resolve);
    scans.set(file, s);
    return s;
  };
  for (const f of new Set([...componentFiles, ...usageFiles])) getScan(f);

  // ── components ──
  // Fast path: parse all component files in one batch (shares the TS program). If docgen throws
  // on any single file, isolate the failure by re-parsing file by file so one bad file doesn't
  // blank out every component.
  let docs: ReturnType<typeof analysis.parseProps> = [];
  try {
    docs = analysis.parseProps(componentFiles);
  } catch {
    docs = [];
    for (const file of componentFiles) {
      try {
        docs.push(...analysis.parseProps([file]));
      } catch (e) {
        warnings.push(`Props extraction failed for ${rel(file)}: ${(e as Error).message}`);
      }
    }
  }

  const components: ComponentInfo[] = [];
  const byFileExport = new Map<string, ComponentInfo>(); // `${absFile}#${exportName}`
  for (const file of componentFiles) {
    const scan = getScan(file);
    if (!scan) continue;
    for (const doc of docs.filter((d) => path.resolve(d.filePath) === file)) {
      const exportName = scan.exports.includes(doc.displayName) ? doc.displayName : scan.exports.includes("default") ? "default" : undefined;
      if (!exportName) continue;
      // A barrel (`export { Button } from "./Button"`): docgen documents the re-export at the barrel's path, but the
      // component is defined elsewhere. Imports through the barrel are followed back to it by resolveExport.
      if (scan.reExports.some((re) => re.exported === exportName)) continue;
      const relFile = rel(file);
      const { props, inheritedPropCount } = toPropInfo(doc);
      const c: ComponentInfo = {
        id: `${relFile}#${exportName}`,
        name: doc.displayName,
        exportName,
        file: relFile,
        folder: path.posix.dirname(relFile),
        source: { kind: "custom" },
        props,
        inheritedPropCount,
        builtFrom: { library: [], own: [] },
        usages: [],
        isIcon: false,
      };
      if (doc.description) c.description = doc.description;
      components.push(c);
      byFileExport.set(`${file}#${exportName}`, c);
    }
  }

  /** Follow barrels: which component does `imported` from `file` refer to? */
  const resolveExport = (file: string, imported: string, depth = 0): ComponentInfo | undefined => {
    const direct = byFileExport.get(`${file}#${imported}`);
    if (direct || depth > 5) return direct;
    const scan = getScan(file);
    if (!scan) return undefined;
    for (const re of scan.reExports) {
      if (!re.resolvedFile) continue;
      if (re.exported === imported) {
        const hit = resolveExport(re.resolvedFile, re.imported, depth + 1);
        if (hit) return hit;
      }
      if (re.exported === "*") {
        const hit = resolveExport(re.resolvedFile, imported, depth + 1);
        if (hit) return hit;
      }
    }
    return undefined;
  };

  // ── built-from + wraps ──
  const primitives = new Set(adapter.layoutPrimitives);
  for (const c of components) {
    const scan = getScan(path.join(root, c.file));
    if (!scan) continue;
    const rendered = [...scan.jsx.map((j) => j.tag), ...scan.styledTargets];
    const library: string[] = [];
    const own: string[] = [];
    for (const tag of rendered) {
      const b = scan.imports.find((i) => i.local === tag);
      if (!b) continue;
      const lib = adapter.classifyImport(b.specifier, b.imported);
      if (lib && !library.includes(lib)) library.push(lib);
      if (b.resolvedFile) {
        const target = resolveExport(b.resolvedFile, b.imported);
        if (target && target.id !== c.id && !own.includes(target.id)) own.push(target.id);
      }
    }
    c.builtFrom = { library, own };
    const wrappable = library.filter((l) => !primitives.has(l));
    if (wrappable.length) {
      const pick = wrappable.find((l) => c.name.includes(l)) ?? wrappable[0]!;
      c.source = { kind: "wraps", library: adapter.libraryName, component: pick };
    }
    c.isIcon = c.name.endsWith("Icon") || library.includes("SvgIcon");
  }

  // ── usages, raw library usage, icons ──
  const libraryUsage = new Map<string, CallSite[]>();
  const libIcons = new Map<string, IconInfo>();
  for (const scan of scans.values()) {
    const relFile = rel(scan.file);
    const isComponentFile = componentSet.has(scan.file);
    for (const b of scan.imports) {
      const sites = (): CallSite[] => scan.jsx.filter((j) => j.tag === b.local).map((j) => ({ file: relFile, line: j.line }));
      if (b.resolvedFile) {
        const target = resolveExport(b.resolvedFile, b.imported);
        if (target && target.file !== relFile) target.usages.push(...sites());
      }
      const lib = adapter.classifyImport(b.specifier, b.imported);
      if (lib && !isComponentFile) libraryUsage.set(lib, [...(libraryUsage.get(lib) ?? []), ...sites()]);
      const icon = adapter.classifyIconImport(b.specifier, b.imported);
      if (icon) {
        const key = `${b.specifier}#${icon}`;
        const entry = libIcons.get(key) ?? { name: icon, source: "library" as const, importPath: b.specifier, sites: [] };
        entry.sites.push(...sites());
        libIcons.set(key, entry);
      }
    }
  }
  for (const c of components) c.usages.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const icons: IconInfo[] = [
    ...libIcons.values(),
    ...components.filter((c) => c.isIcon).map((c) => ({ name: c.name, source: "custom" as const, importPath: c.file, componentId: c.id, sites: c.usages })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // ── static findings ──
  const findings: StaticFinding[] = [];
  for (const scan of scans.values()) {
    if (!componentSet.has(scan.file) && !usageSet.has(scan.file)) continue; // skip barrels pulled in on demand
    findings.push(...findStaticIssues(rel(scan.file), fs.readFileSync(scan.file, "utf8")));
  }

  return {
    name: config.name,
    root,
    adapter: adapter.id,
    libraryName: adapter.libraryName,
    libraryVersion: readPackageVersion(root, adapter.packageName),
    themeEntry: config.themeEntry ? rel(config.themeEntry) : undefined,
    themeExport: config.themeExport,
    components: components.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)),
    libraryUsage: [...libraryUsage.entries()]
      .filter(([, sites]) => sites.length)
      .map(([component, sites]): LibraryUsage => ({ component, sites }))
      .sort((a, b) => b.sites.length - a.sites.length || a.component.localeCompare(b.component)),
    icons,
    findings,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
