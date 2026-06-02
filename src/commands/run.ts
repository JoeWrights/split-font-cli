import path from "node:path";

import type { Command } from "commander";

import { findConfigFile, loadConfig } from "../core/config-loader.js";
import { ConfigError } from "../core/errors.js";
import { splitFont } from "../core/font-splitter.js";
import type { Logger } from "../utils/logger.js";
import { formatBytes } from "../utils/fs.js";
import { resolvePath } from "../utils/paths.js";

interface RunFlags {
    config?: string;
}

/**
 * 注册 `split-font run` 子命令：读取配置文件，串行执行所有 tasks。
 *
 * 配置文件查找逻辑见 core/config-loader.ts:findConfigFile。
 * 输出目录路径 = `<root.outDir | ./output>/<task.name | basenameOfFont>/`。
 */
export function registerRunCommand(program: Command, logger: Logger): void {
    program
        .command("run")
        .description("读取配置文件，批量执行所有切片任务（推荐主用法）")
        .option(
            "-c, --config <path>",
            "配置文件路径（默认在 cwd 中查找 split-font.config.{ts,js,json}）"
        )
        .action(async (flags: RunFlags) => {
            const configPath = flags.config
                ? resolvePath(flags.config)
                : await findConfigFile();

            if (!configPath) {
                throw new ConfigError(
                    "未找到配置文件，请使用 --config 指定，或在当前目录创建 split-font.config.ts"
                );
            }

            logger.info(`加载配置：${configPath}`);
            const config = await loadConfig(configPath);
            const outDir = resolvePath(
                config.outDir ?? "./output",
                path.dirname(configPath)
            );

            logger.info(
                `共 ${config.tasks.length} 个任务，输出目录：${outDir}`
            );

            const summary: Array<{
                name: string;
                files: number;
                bytes: number;
                ms: number;
            }> = [];

            for (let i = 0; i < config.tasks.length; i++) {
                const task = config.tasks[i];
                if (!task) continue;
                logger.info(`[${i + 1}/${config.tasks.length}] ${task.name ?? task.font}`);
                const result = await splitFont(task, outDir, logger);
                summary.push({
                    name: task.name ?? task.font,
                    files: result.fontFiles,
                    bytes: result.totalBytes,
                    ms: result.elapsedMs,
                });
            }

            logger.success("全部任务完成：");
            for (const item of summary) {
                logger.info(
                    `  • ${item.name}: ${item.files} 文件 / ${formatBytes(
                        item.bytes
                    )} / ${(item.ms / 1000).toFixed(2)}s`
                );
            }
            if (config.cdn?.prefix) {
                logger.info(`CDN 前缀：${config.cdn.prefix}`);
            }
        });
}
