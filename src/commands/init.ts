import path from "node:path";

import type { Command } from "commander";

import { CliError } from "../core/errors.js";
import type { Logger } from "../utils/logger.js";
import { pathExists } from "../utils/fs.js";
import { promises as fsp } from "node:fs";

interface InitFlags {
    ts?: boolean;
    js?: boolean;
    json?: boolean;
    force?: boolean;
}

const TS_TEMPLATE = `import { defineConfig } from "split-font-cli";

export default defineConfig({
    outDir: "./output",
    cdn: {
        prefix: "https://web.hycdn.cn/fonts/",
    },
    tasks: [
        {
            name: "SourceHanSansCN-VF",
            font: "./assets/font/SourceHanSansCN-VF.ttf",
            ranges: "./assets/ranges-cn.json",
        },
        // {
        //     name: "SourceHanSansJP-VF",
        //     font: "./assets/font/SourceHanSansJP-VF.ttf",
        //     ranges: "./assets/ranges-jp.json",
        // },
    ],
});
`;

const JS_TEMPLATE = `import { defineConfig } from "split-font-cli";

export default defineConfig({
    outDir: "./output",
    tasks: [
        {
            name: "SourceHanSansCN-VF",
            font: "./assets/font/SourceHanSansCN-VF.ttf",
            ranges: "./assets/ranges-cn.json",
        },
    ],
});
`;

const JSON_TEMPLATE = `{
    "outDir": "./output",
    "tasks": [
        {
            "name": "SourceHanSansCN-VF",
            "font": "./assets/font/SourceHanSansCN-VF.ttf",
            "ranges": "./assets/ranges-cn.json"
        }
    ]
}
`;

/**
 * 注册 `split-font init` 子命令：向当前目录写入示例配置。
 * 默认 TS；可用 --js / --json 切换。
 */
export function registerInitCommand(program: Command, logger: Logger): void {
    program
        .command("init")
        .description("在当前目录生成示例配置文件")
        .option("--ts", "生成 split-font.config.ts（默认）", false)
        .option("--js", "生成 split-font.config.js", false)
        .option("--json", "生成 split-font.config.json", false)
        .option("--force", "若同名文件已存在则覆盖", false)
        .action(async (flags: InitFlags) => {
            const formats = [flags.ts, flags.js, flags.json].filter(Boolean);
            if (formats.length > 1) {
                throw new CliError(
                    "--ts / --js / --json 互斥，只能选其一"
                );
            }

            let fileName = "split-font.config.ts";
            let content = TS_TEMPLATE;
            if (flags.js) {
                fileName = "split-font.config.js";
                content = JS_TEMPLATE;
            } else if (flags.json) {
                fileName = "split-font.config.json";
                content = JSON_TEMPLATE;
            }

            const target = path.join(process.cwd(), fileName);
            if ((await pathExists(target)) && !flags.force) {
                throw new CliError(
                    `${fileName} 已存在，使用 --force 覆盖`
                );
            }

            await fsp.writeFile(target, content, "utf-8");
            logger.success(`已生成 ${fileName}`);
            logger.info("下一步：编辑 tasks，然后运行 `split-font run`");
        });
}
