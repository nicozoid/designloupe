import path from "node:path";
import { hintFor, type AdapterBrowser, type DiscoveryModel, type ResolvedConfig } from "@designloupe/core";
import { createLoupeServer } from "./server";

type Row = { ok: boolean; label: string; message?: string };

export async function runDoctor(config: ResolvedConfig, log: (line: string) => void = console.log): Promise<number> {
  log(`Design Loupe doctor: ${config.name}`);
  log(`  config   ${config.configPath}`);
  log(`  root     ${config.root}`);
  log(`  theme    ${config.themeEntry ?? "(none)"} → ${config.themeExport}`);
  log(`  wrapper  ${config.wrapper ?? "(none)"}`);
  log(`  presets  ${config.presets.join(", ") || "(none)"}`);

  const t0 = Date.now();
  const server = await createLoupeServer(config, { middlewareMode: true });
  const rows: Row[] = [];
  let code = 0;
  const check = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      rows.push({ ok: true, label });
      return true;
    } catch (e) {
      rows.push({ ok: false, label, message: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };

  try {
    const model = (await server.ssrLoadModule("virtual:loupe/model")).default as DiscoveryModel;
    log(`\nDiscovery: ${model.components.length} components, ${model.icons.length} icons, ${model.findings.length} static findings (${Date.now() - t0}ms)`);
    for (const w of model.warnings) log(`  ! ${w}`);

    if (config.themeEntry) {
      const ok = await check("theme", async () => {
        const { loadTheme } = await server.ssrLoadModule("virtual:loupe/theme");
        const theme = await loadTheme();
        const adapter = (await server.ssrLoadModule("virtual:loupe/adapter")).default as AdapterBrowser;
        if (!adapter.isTheme(theme)) throw new Error(`Export "${config.themeExport}" is not a ${adapter.libraryName} theme.`);
      });
      if (!ok) code = 1;
    }
    if (config.wrapper) {
      await check("wrapper", async () => {
        const { loadWrapper } = await server.ssrLoadModule("virtual:loupe/wrapper");
        if (typeof (await loadWrapper()) !== "function") throw new Error("Wrapper's default export is not a component.");
      });
    }
    const files = await server.ssrLoadModule("virtual:loupe/loupe-files");
    for (const [i, load] of (files.componentDocs as (() => Promise<unknown>)[]).entries()) await check(`loupe file #${i + 1}`, async () => void (await load()));
    for (const file of [...new Set(model.components.map((c) => c.file))]) {
      await check(file, async () => void (await server.ssrLoadModule(path.join(config.root, file))));
    }
  } finally {
    await server.close();
  }

  log("");
  for (const r of rows) {
    log(`${r.ok ? "✓" : "✗"} ${r.label}`);
    if (!r.ok) {
      log(`    ${r.message}`);
      const hint = hintFor(r.message ?? "");
      if (hint) log(`    → ${hint}`);
    }
  }
  const failed = rows.filter((r) => !r.ok).length;
  log(`\n${rows.length - failed}/${rows.length} OK${failed ? `, ${failed} failing` : ""}.${code ? " Theme failed: fix it first." : ""}`);
  log("Note: doctor loads modules in Node. Browser-only code may fail here and still work in the viewer.");
  return code;
}
