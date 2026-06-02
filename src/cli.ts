#!/usr/bin/env node
import { promises as fsp } from "node:fs";
import path from "node:path";

import { Command } from "commander";

import { registerInitCommand } from "./commands/init.js";
import { registerRangeCommand } from "./commands/range.js";
import { registerRunCommand } from "./commands/run.js";
import { registerSplitCommand } from "./commands/split.js";
import { CliError } from "./core/errors.js";
import { logger } from "./utils/logger.js";
import { getDirname } from "./utils/paths.js";

interface GlobalFlags {
    verbose?: boolean;
    silent?: boolean;
}

async function readPackageJson(): Promise<{
    name: string;
    version: string;
    description?: string;
}> {
    // dist/cli.js 与 dist/index.js 同级，package.json 在上一级
    const here = getDirname(import.meta.url);
    const candidates = [
        path.resolve(here, "../package.json"),
        path.resolve(here, "./package.json"),
    ];
    for (const c of candidates) {
        try {
            const raw = await fsp.readFile(c, "utf-8");
            return JSON.parse(raw);
        } catch {
            // try next candidate
        }
    }
    return { name: "split-font-cli", version: "0.0.0" };
}

async function main(): Promise<void> {
    const pkg = await readPackageJson();

    const program = new Command();
    program
        .name("split-font")
        .description(
            pkg.description ??
                "Slice CJK variable fonts into woff2 subsets via cn-font-split."
        )
        .version(pkg.version, "-V, --version", "查看版本号")
        .option("-v, --verbose", "显示详细日志", false)
        .option("--silent", "静默模式，仅输出错误", false)
        .hook("preAction", (cmd) => {
            const opts = cmd.opts<GlobalFlags>();
            if (opts.silent) {
                logger.setLevel("silent");
            } else if (opts.verbose) {
                logger.setLevel("verbose");
            } else {
                logger.setLevel("info");
            }
        });

    registerRangeCommand(program, logger);
    registerSplitCommand(program, logger);
    registerRunCommand(program, logger);
    registerInitCommand(program, logger);

    program.showHelpAfterError("(运行 split-font --help 查看帮助)");

    await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
    if (err instanceof CliError) {
        logger.error(err);
        if (logger.isVerbose && err.stack) {
            console.error(err.stack);
        }
        process.exit(err.exitCode);
    }
    if (err instanceof Error) {
        logger.error(err);
        if (logger.isVerbose && err.stack) {
            console.error(err.stack);
        }
    } else {
        logger.error(String(err));
    }
    process.exit(2);
});
