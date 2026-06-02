import type { Command } from "commander";

import { splitFont } from "../core/font-splitter.js";
import type { Logger } from "../utils/logger.js";
import type { SplitTarget, TaskConfig } from "../types.js";
import { CliError } from "../core/errors.js";

interface SplitFlags {
    font: string;
    ranges: string;
    out?: string;
    name?: string;
    target?: string;
    hash?: string;
    fontFeature?: boolean;
    subsetRemainChars?: boolean;
    reporter?: boolean;
    testHtml?: boolean;
}

const VALID_TARGETS: SplitTarget[] = ["woff2", "woff", "ttf"];

/**
 * 注册 `split-font split` 子命令：单任务切片，主要用于命令行临时调试。
 * 批量场景请使用 `split-font run` + 配置文件。
 */
export function registerSplitCommand(program: Command, logger: Logger): void {
    program
        .command("split")
        .description("根据切片规则把 TTF 切成 woff2 + CSS")
        .requiredOption("-f, --font <path>", "源字体文件路径")
        .requiredOption(
            "-r, --ranges <path>",
            "ranges JSON 路径（由 `split-font range` 产出）"
        )
        .option("-o, --out <dir>", "产物输出目录", "./output")
        .option(
            "-n, --name <name>",
            "输出文件名与 font-family（不传则由 font 文件名推导）"
        )
        .option(
            "--target <type>",
            `产物格式，可选：${VALID_TARGETS.join(" / ")}`,
            "woff2"
        )
        .option(
            "--hash <length>",
            "文件名 hash 长度，0 表示禁用",
            "6"
        )
        .option(
            "--font-feature",
            "保留 OpenType features（默认关闭，可显著减小体积）",
            false
        )
        .option(
            "--subset-remain-chars",
            "为未覆盖字符生成兜底子集（默认关闭）",
            false
        )
        .option("--reporter", "产出可视化体积报表", false)
        .option("--test-html", "产出测试 HTML 验证页", false)
        .action(async (flags: SplitFlags) => {
            const target = (flags.target ?? "woff2") as SplitTarget;
            if (!VALID_TARGETS.includes(target)) {
                throw new CliError(
                    `--target 取值非法：${flags.target}，允许：${VALID_TARGETS.join(" / ")}`
                );
            }
            const hashNum = Number.parseInt(flags.hash ?? "6", 10);
            if (Number.isNaN(hashNum) || hashNum < 0) {
                throw new CliError(`--hash 必须是 >= 0 的整数`);
            }

            const task: TaskConfig = {
                font: flags.font,
                ranges: flags.ranges,
                target,
                hash: hashNum,
                fontFeature: flags.fontFeature,
                subsetRemainChars: flags.subsetRemainChars,
                reporter: flags.reporter,
                testHtml: flags.testHtml,
            };
            if (flags.name) task.name = flags.name;

            const result = await splitFont(
                task,
                flags.out ?? "./output",
                logger
            );

            if (result.cssPath) {
                logger.info(`CSS：${result.cssPath}`);
            }
        });
}
