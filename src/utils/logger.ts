import pc from "picocolors";

import type { LogLevel } from "../types.js";

/**
 * 极简 Logger：支持 silent / info / verbose 三档。
 *
 * - silent  : 仅输出 error 到 stderr。
 * - info    : 默认；输出 info / success / warn / error。
 * - verbose : 在 info 基础上多输出 debug 与时间统计。
 */
export class Logger {
    private level: LogLevel;
    private timers = new Map<string, number>();

    constructor(level: LogLevel = "info") {
        this.level = level;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    getLevel(): LogLevel {
        return this.level;
    }

    get isSilent(): boolean {
        return this.level === "silent";
    }

    get isVerbose(): boolean {
        return this.level === "verbose";
    }

    private get shouldInfo(): boolean {
        return this.level !== "silent";
    }

    private get shouldDebug(): boolean {
        return this.level === "verbose";
    }

    info(msg: string): void {
        if (this.shouldInfo) console.log(pc.cyan("ℹ"), msg);
    }

    success(msg: string): void {
        if (this.shouldInfo) console.log(pc.green("✔"), msg);
    }

    warn(msg: string): void {
        if (this.shouldInfo) console.warn(pc.yellow("⚠"), msg);
    }

    error(msg: string | Error): void {
        const text = msg instanceof Error ? msg.message : msg;
        console.error(pc.red("✖"), text);
    }

    debug(msg: string): void {
        if (this.shouldDebug) console.log(pc.gray("·"), pc.gray(msg));
    }

    time(label: string): void {
        if (this.shouldDebug) this.timers.set(label, Date.now());
    }

    timeEnd(label: string): void {
        if (!this.shouldDebug) return;
        const start = this.timers.get(label);
        if (start === undefined) return;
        this.timers.delete(label);
        const elapsed = Date.now() - start;
        this.debug(`${label}: ${elapsed}ms`);
    }
}

/** 默认实例，命令行入口在解析 flags 后会修改其 level。 */
export const logger = new Logger();
