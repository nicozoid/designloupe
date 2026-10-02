#!/usr/bin/env -S npx tsx
import { cac } from "cac";
import { loadConfig, ConfigError } from "@designloupe/core/node";
import { createLoupeServer } from "./server";

const cli = cac("designloupe");

cli
  .command("dev", "Start the Design Loupe viewer")
  .option("--config <path>", "Path to loupe.config.ts", { default: "loupe.config.ts" })
  .option("--port <port>", "Port (default 5179)")
  .option("--open", "Open the browser")
  .action(async (o: { config: string; port?: string; open?: boolean }) => {
    const config = await loadConfig(o.config);
    const server = await createLoupeServer(config, { port: o.port ? Number(o.port) : undefined, open: o.open });
    await server.listen();
    console.log(`\n  Design Loupe — ${config.name}`);
    server.printUrls();
  });

cli
  .command("doctor", "Check the config and that every target module loads")
  .option("--config <path>", "Path to loupe.config.ts", { default: "loupe.config.ts" })
  .action(async (o: { config: string }) => {
    const { runDoctor } = await import("./doctor");
    process.exitCode = await runDoctor(await loadConfig(o.config));
  });

cli.help();

try {
  cli.parse(process.argv, { run: false });
  if (!cli.matchedCommand) cli.outputHelp();
  else await cli.runMatchedCommand();
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`\n  ✗ Config error in "${e.field}": ${e.message}\n`);
    process.exit(2);
  }
  throw e;
}
