import path from "node:path";

import type { Command } from "commander";

import { parseUnicodeRangeFile } from "../core/range-parser.js";
import type { Logger } from "../utils/logger.js";
import { writeJson } from "../utils/fs.js";
import { basenameWithoutExt, resolvePath } from "../utils/paths.js";

interface RangeFlags {
    input: string;
    output?: string;
    pretty?: boolean;
}

/**
 * 注册 `split-font range` 子命令。
 *
 * 设计要点：
 *  - 默认输出路径与输入同目录，文件名替换为 `<input>.json`，
 *    覆盖最常见的"先放 google-xx.css 进来，再就地生成 ranges-xx.json"用法。
 *  - 真正的解析逻辑在 core/range-parser.ts，本文件仅做 CLI ↔ 函数翻译。
 */
export function registerRangeCommand(program: Command, logger: Logger): void {
    program
        .command("range")
        .description("从 Google Fonts CSS 解析 unicode-range，输出切片规则 JSON")
        .requiredOption(
            "-i, --input <path>",
            "Google Fonts CSS 文件路径"
        )
        .option(
            "-o, --output <path>",
            "切片规则输出路径，默认与 input 同目录 .json"
        )
        .option("--pretty", "格式化输出 JSON（缩进 4 空格）", true)
        .option("--no-pretty", "压缩 JSON 输出")
        .action(async (flags: RangeFlags) => {
            const inputPath = resolvePath(flags.input);
            const outputPath = resolvePath(
                flags.output ??
                    path.join(
                        path.dirname(inputPath),
                        `${basenameWithoutExt(inputPath)}.json`
                    )
            );

            logger.info(`解析 CSS：${inputPath}`);
            const map = await parseUnicodeRangeFile(inputPath);
            const segCount = Object.keys(map).length;
            const codepointCount = Object.values(map).reduce(
                (sum, arr) => sum + arr.length,
                0
            );

            await writeJson(outputPath, map, flags.pretty !== false);

            logger.success(
                `生成 ranges：${outputPath}（${segCount} 段 / ${codepointCount} 码点）`
            );
        });
}
