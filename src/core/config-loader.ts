import { promises as fsp } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createJiti } from "jiti";

import { ConfigError } from "./errors.js";
import type { RootConfig, TaskConfig } from "../types.js";
import { pathExists } from "../utils/fs.js";
import { resolvePath } from "../utils/paths.js";

/** 按优先级从高到低查找的默认配置文件名。 */
const DEFAULT_CONFIG_NAMES = [
    "split-font.config.ts",
    "split-font.config.mts",
    "split-font.config.js",
    "split-font.config.mjs",
    "split-font.config.cjs",
    "split-font.config.json",
];

/**
 * 在 `cwd` 中按默认顺序查找配置文件，找不到返回 null。
 */
export async function findConfigFile(cwd = process.cwd()): Promise<string | null> {
    for (const name of DEFAULT_CONFIG_NAMES) {
        const candidate = path.join(cwd, name);
        if (await pathExists(candidate)) {
            return candidate;
        }
    }

    // 兜底：package.json 中的 "split-font" 字段
    const pkgPath = path.join(cwd, "package.json");
    if (await pathExists(pkgPath)) {
        try {
            const pkg = JSON.parse(await fsp.readFile(pkgPath, "utf-8"));
            if (pkg && typeof pkg === "object" && "split-font" in pkg) {
                return pkgPath;
            }
        } catch {
            // 忽略 package.json 解析失败，让上层处理
        }
    }

    return null;
}

/**
 * 加载并校验配置：
 *
 * - `.json`           : 直接 JSON.parse。
 * - `.ts/.mts/.cjs`   : 走 jiti 即时编译，避免要求用户装 ts-node。
 * - `.js/.mjs`        : 用原生 `import()`（pathToFileURL，跨平台稳定）。
 * - `package.json`    : 读 "split-font" 字段。
 *
 * 校验失败统一抛 ConfigError，CLI 顶层负责退出码 1。
 */
export async function loadConfig(configPath: string): Promise<RootConfig> {
    if (!(await pathExists(configPath))) {
        throw new ConfigError(`配置文件不存在：${configPath}`);
    }

    const ext = path.extname(configPath).toLowerCase();
    const fileName = path.basename(configPath).toLowerCase();

    let raw: unknown;
    if (fileName === "package.json") {
        const pkg = JSON.parse(await fsp.readFile(configPath, "utf-8"));
        raw = (pkg as Record<string, unknown>)["split-font"];
    } else if (ext === ".json") {
        raw = JSON.parse(await fsp.readFile(configPath, "utf-8"));
    } else if (ext === ".ts" || ext === ".mts" || ext === ".cjs") {
        const jiti = createJiti(import.meta.url, {
            interopDefault: true,
            moduleCache: false,
        });
        raw = await jiti.import(configPath, { default: true });
    } else if (ext === ".js" || ext === ".mjs") {
        const mod = await import(pathToFileURL(configPath).href);
        raw = mod.default ?? mod;
    } else {
        throw new ConfigError(
            `不支持的配置文件扩展名：${ext}（来源 ${configPath}）`
        );
    }

    return assertConfig(raw, configPath);
}

/** 仅做类型透传，方便 `split-font.config.ts` 获得补全。 */
export function defineConfig(config: RootConfig): RootConfig {
    return config;
}

/**
 * 运行时校验：保证后续 `splitFont` 调用拿到的字段都是合法的，
 * 提前在 CLI 层抛出更友好的错误。
 */
function assertConfig(raw: unknown, source: string): RootConfig {
    if (!raw || typeof raw !== "object") {
        throw new ConfigError(`配置必须是对象，来源 ${source}`);
    }
    const cfg = raw as Record<string, unknown>;

    const tasks = cfg.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new ConfigError(
            `配置 ${source} 中 tasks 必须是非空数组`
        );
    }

    const outDir =
        typeof cfg.outDir === "string" && cfg.outDir.length > 0
            ? cfg.outDir
            : "./output";

    const normalizedTasks: TaskConfig[] = tasks.map((task, idx) =>
        assertTask(task, idx, source)
    );

    const cdn = cfg.cdn;
    const result: RootConfig = {
        outDir,
        tasks: normalizedTasks,
    };
    if (cdn && typeof cdn === "object") {
        const prefix = (cdn as Record<string, unknown>).prefix;
        if (typeof prefix === "string") {
            result.cdn = { prefix };
        }
    }

    return result;
}

function assertTask(task: unknown, idx: number, source: string): TaskConfig {
    if (!task || typeof task !== "object") {
        throw new ConfigError(
            `tasks[${idx}] 必须是对象（来源 ${source}）`
        );
    }
    const t = task as Record<string, unknown>;

    if (typeof t.font !== "string" || t.font.length === 0) {
        throw new ConfigError(
            `tasks[${idx}].font 必填且必须是字符串（来源 ${source}）`
        );
    }
    if (
        typeof t.ranges !== "string" &&
        (typeof t.ranges !== "object" || t.ranges === null)
    ) {
        throw new ConfigError(
            `tasks[${idx}].ranges 必填，可以是 JSON 路径或 RangeMap 对象（来源 ${source}）`
        );
    }

    const taskConfig: TaskConfig = {
        font: resolvePath(t.font, path.dirname(source)),
        ranges:
            typeof t.ranges === "string"
                ? resolvePath(t.ranges, path.dirname(source))
                : (t.ranges as Record<string, string[]>),
    };

    if (typeof t.name === "string" && t.name.length > 0) {
        taskConfig.name = t.name;
    }

    const passthroughFlags: (keyof TaskConfig)[] = [
        "target",
        "hash",
        "fontFeature",
        "subsetRemainChars",
        "reporter",
        "testHtml",
        "languageAreas",
        "autoSubset",
        "reduceMins",
    ];
    for (const key of passthroughFlags) {
        if (t[key] !== undefined) {
            (taskConfig as unknown as Record<string, unknown>)[key] = t[key];
        }
    }

    return taskConfig;
}
