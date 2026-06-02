/**
 * 公共类型：CLI 与库 API 共享。
 *
 * 这里的类型刻意与 `cn-font-split` 解耦，目的是让上层不直接耦合到
 * cn-font-split 的私有协议（protobuf 生成的 InputTemplate 等），
 * 使本 CLI 在 cn-font-split 升级时更稳定。
 */

/**
 * 解析后的 unicode-range 映射：
 *  - key   : Google CSS 注释里出现的段名，如 "[4]"、"[100]"。
 *  - value : 该段落对应的码点字符串数组，形如 ["U+4e00", "U+4e01", ...]。
 *
 * 单点 `U+xxxx` 直接保留，区间 `U+xxxx-yyyy` 会被展开成离散码点。
 */
export type RangeMap = Record<string, string[]>;

/** 切片目标格式。 */
export type SplitTarget = "woff2" | "woff" | "ttf";

/**
 * 单次字体切片任务的配置（库 API + 配置文件 + CLI 参数 三处共用）。
 */
export interface TaskConfig {
    /**
     * 输出文件名与 `font-family`，会出现在产物 CSS 的 `@font-face` 中。
     * 不传时按 `font` 文件名（去扩展名）推导。
     */
    name?: string;

    /** 源字体路径（推荐传可变字体的 TTF / OTF）。 */
    font: string;

    /**
     * 切片规则：可以是 `range` 命令产出的 JSON 文件路径，
     * 也可以是已经加载到内存的 RangeMap。
     */
    ranges: string | RangeMap;

    /** 输出格式，默认 `woff2`。 */
    target?: SplitTarget;

    /**
     * 文件名中的内容哈希长度（重命名模板 `<name>.[hash:N].[ext]`）。
     * 0 表示不带 hash。默认 6。
     */
    hash?: number;

    /** 是否保留 OpenType features，默认 `false`（关掉可显著减小体积）。 */
    fontFeature?: boolean;

    /** 是否为未覆盖字符生成兜底子集，默认 `false`。 */
    subsetRemainChars?: boolean;

    /** 是否产出可视化体积报表，默认 `false`。 */
    reporter?: boolean;

    /** 是否产出测试 HTML，默认 `false`。 */
    testHtml?: boolean;

    /** 是否启用语言区自动切分，默认 `false`（手动 subsets 已经精确控制）。 */
    languageAreas?: boolean;

    /** 是否自动子集化，默认 `false`。 */
    autoSubset?: boolean;

    /** 是否启用字形压缩（reduce mins），默认 `false`。 */
    reduceMins?: boolean;
}

/**
 * 根配置（`split-font.config.ts` 等导出的对象）。
 */
export interface RootConfig {
    /**
     * 所有任务共用的输出根目录，最终落到 `<outDir>/<name>/`。
     * 默认 `./output`。
     */
    outDir?: string;

    /** 任务列表，按声明顺序串行执行。 */
    tasks: TaskConfig[];

    /**
     * 仅作语义注释用的 CDN 前缀，不影响构建产物，
     * 但 `run` 命令收尾时会打印出来方便业务方拼接。
     */
    cdn?: {
        prefix?: string;
    };
}

/**
 * `splitFont` 返回值，便于 `run` 命令做汇总。
 */
export interface SplitResult {
    /** 该任务对应的产物目录。 */
    outDir: string;
    /** 产出的字体文件数量（woff2/woff/ttf）。 */
    fontFiles: number;
    /** 产物总字节数（不含 result.css）。 */
    totalBytes: number;
    /** 耗时（毫秒）。 */
    elapsedMs: number;
    /** result.css 的绝对路径。 */
    cssPath: string;
}

/** Logger 等级。 */
export type LogLevel = "silent" | "info" | "verbose";
