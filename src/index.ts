/**
 * split-font-cli 的库式入口（编程式 API）。
 *
 * 命令行入口请使用 `bin/split-font`（构建后位于 `dist/cli.js`）。
 */
export { splitFont } from "./core/font-splitter.js";
export {
    expandUnicodeRange,
    parseUnicodeLiteral,
    parseUnicodeRangeCss,
    parseUnicodeRangeFile,
    rangeMapToSubsets,
} from "./core/range-parser.js";
export {
    defineConfig,
    findConfigFile,
    loadConfig,
} from "./core/config-loader.js";
export {
    CliError,
    ConfigError,
    RangeParseError,
    SplitError,
} from "./core/errors.js";
export { Logger, logger } from "./utils/logger.js";

export type {
    LogLevel,
    RangeMap,
    RootConfig,
    SplitResult,
    SplitTarget,
    TaskConfig,
} from "./types.js";
