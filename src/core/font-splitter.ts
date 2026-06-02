import { promises as fsp } from "node:fs";
import path from "node:path";

import { fontSplit } from "cn-font-split";

import { SplitError } from "./errors.js";
import { rangeMapToSubsets } from "./range-parser.js";
import type {
    RangeMap,
    SplitResult,
    SplitTarget,
    TaskConfig,
} from "../types.js";
import {
    formatBytes,
    listFiles,
    pathExists,
    readJson,
    sumFileBytes,
} from "../utils/fs.js";
import { logger as defaultLogger, Logger } from "../utils/logger.js";
import { basenameWithoutExt, resolvePath } from "../utils/paths.js";

/**
 * 库式调用入口。给定一个 TaskConfig，输出到 `<outDir>/<name>/`。
 *
 * 默认值与 fonts/src/split.mjs 完全对齐，行为可向后兼容：
 *  - targetType        = woff2
 *  - subsetRemainChars = false
 *  - languageAreas     = false
 *  - autoSubset        = false
 *  - fontFeature       = false
 *  - reduceMins        = false
 *  - renameOutputFont  = `<name>.[hash:6].[ext]`
 *  - css.fontFamily    = name
 *  - testHtml/reporter = false
 */
export async function splitFont(
    task: TaskConfig,
    outDir: string,
    logger: Logger = defaultLogger
): Promise<SplitResult> {
    const fontPath = resolvePath(task.font);
    if (!(await pathExists(fontPath))) {
        throw new SplitError(`找不到源字体文件：${fontPath}`);
    }

    const name = task.name ?? basenameWithoutExt(fontPath);
    const fontOutDir = resolvePath(path.join(outDir, name));
    await fsp.mkdir(fontOutDir, { recursive: true });

    const rangeMap = await resolveRangeMap(task.ranges);
    const subsets = rangeMapToSubsets(rangeMap);
    if (subsets.length === 0) {
        throw new SplitError(
            `任务 "${name}" 的 ranges 为空，至少需要一个非空段`
        );
    }

    const inputBuffer = new Uint8Array((await fsp.readFile(fontPath)).buffer);

    const target: SplitTarget = task.target ?? "woff2";
    const hash = task.hash ?? 6;
    const renameOutputFont =
        hash > 0
            ? `${name}.[hash:${hash}].[ext]`
            : `${name}.[ext]`;

    logger.info(`开始切片：${name}（${subsets.length} 个子集，目标 ${target}）`);
    logger.debug(`字体路径：${fontPath}`);
    logger.debug(`输出目录：${fontOutDir}`);

    const startedAt = Date.now();
    try {
        await fontSplit({
            input: inputBuffer,
            outDir: fontOutDir,
            targetType: target,
            subsets,
            subsetRemainChars: task.subsetRemainChars ?? false,
            languageAreas: task.languageAreas ?? false,
            autoSubset: task.autoSubset ?? false,
            fontFeature: task.fontFeature ?? false,
            reduceMins: task.reduceMins ?? false,
            renameOutputFont,
            css: {
                fontFamily: name,
            },
            testHtml: task.testHtml ?? false,
            reporter: task.reporter ?? false,
            silent: logger.isSilent,
        });
    } catch (err) {
        throw new SplitError(
            `cn-font-split 执行失败：${(err as Error).message}`
        );
    }

    const elapsedMs = Date.now() - startedAt;
    const fontFiles = listFiles(fontOutDir, ["woff2", "woff", "ttf", "otf"]);
    const totalBytes = sumFileBytes(fontFiles);

    const cssPath = path.join(fontOutDir, "result.css");
    const cssExists = await pathExists(cssPath);

    logger.success(
        `${name} 切片完成：${fontFiles.length} 个文件 / ${formatBytes(
            totalBytes
        )} / 耗时 ${(elapsedMs / 1000).toFixed(2)}s`
    );

    return {
        outDir: fontOutDir,
        fontFiles: fontFiles.length,
        totalBytes,
        elapsedMs,
        cssPath: cssExists ? cssPath : "",
    };
}

/**
 * 把 TaskConfig.ranges 这种"可以是路径也可以是已加载 map"的字段，
 * 规范化为 RangeMap。
 */
async function resolveRangeMap(
    ranges: string | RangeMap
): Promise<RangeMap> {
    if (typeof ranges !== "string") {
        return ranges;
    }
    const rangesPath = resolvePath(ranges);
    if (!(await pathExists(rangesPath))) {
        throw new SplitError(`找不到 ranges 文件：${rangesPath}`);
    }
    try {
        return await readJson<RangeMap>(rangesPath);
    } catch (err) {
        throw new SplitError(
            `解析 ranges 文件失败：${rangesPath}\n${(err as Error).message}`
        );
    }
}
