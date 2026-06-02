import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 兼容 Node 18 的 `__dirname`。
 * Node 20.11 才有 `import.meta.dirname`，本项目 target node18 故仍走 fileURLToPath。
 */
export function getDirname(metaUrl: string): string {
    return path.dirname(fileURLToPath(metaUrl));
}

/**
 * 把可能为相对路径的 input 解析为绝对路径。
 * 基准默认是当前工作目录（`process.cwd()`），可显式传入 base 来覆盖。
 */
export function resolvePath(p: string, base = process.cwd()): string {
    return path.isAbsolute(p) ? p : path.resolve(base, p);
}

/** 取文件名中去掉扩展名的部分，如 `SourceHanSansCN-VF.ttf` -> `SourceHanSansCN-VF`。 */
export function basenameWithoutExt(p: string): string {
    const base = path.basename(p);
    const ext = path.extname(base);
    return ext ? base.slice(0, -ext.length) : base;
}
