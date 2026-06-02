/**
 * CLI 自定义错误体系：所有可预期的业务错误都应抛出 `CliError`，
 * 顶层会捕获并按 `verbose` 决定是否打印堆栈。
 */
export class CliError extends Error {
    /** 命令行进程退出码。 */
    readonly exitCode: number;

    constructor(message: string, exitCode = 1) {
        super(message);
        this.name = "CliError";
        this.exitCode = exitCode;
    }
}

/** Google CSS 解析失败（unicode-range 提取不出来 / 格式异常等）。 */
export class RangeParseError extends CliError {
    constructor(message: string) {
        super(`[range] ${message}`);
        this.name = "RangeParseError";
    }
}

/** 配置文件相关错误。 */
export class ConfigError extends CliError {
    constructor(message: string) {
        super(`[config] ${message}`);
        this.name = "ConfigError";
    }
}

/** 字体切片过程中的错误（不存在的字体、cn-font-split 抛错等）。 */
export class SplitError extends CliError {
    constructor(message: string) {
        super(`[split] ${message}`);
        this.name = "SplitError";
    }
}
