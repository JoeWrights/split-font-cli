import {
    constants as fsConstants,
    promises as fsp,
    readdirSync,
    statSync,
} from "node:fs";
import path from "node:path";

/** 判断文件/目录是否存在。 */
export async function pathExists(p: string): Promise<boolean> {
    try {
        await fsp.access(p, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/** 读取 JSON 文件并解析。 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
    const raw = await fsp.readFile(filePath, "utf-8");
    try {
        return JSON.parse(raw) as T;
    } catch (err) {
        throw new Error(
            `解析 JSON 失败：${filePath}\n${(err as Error).message}`
        );
    }
}

/** 写入 JSON 文件（自动创建父目录）。 */
export async function writeJson(
    filePath: string,
    data: unknown,
    pretty = true
): Promise<void> {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const content = pretty
        ? JSON.stringify(data, null, 4)
        : JSON.stringify(data);
    await fsp.writeFile(filePath, content + "\n", "utf-8");
}

/**
 * 递归列出某目录下符合后缀的文件（仅一层，不深入子目录），返回绝对路径数组。
 * 用于 SplitResult 汇总字体文件数量与体积。
 */
export function listFiles(dir: string, exts: string[]): string[] {
    const normalized = exts.map((e) => (e.startsWith(".") ? e : `.${e}`));
    const entries = readdirSync(dir, { withFileTypes: true });
    const result: string[] = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (normalized.includes(ext)) {
            result.push(path.join(dir, entry.name));
        }
    }
    return result;
}

/** 统计若干文件的总字节数。 */
export function sumFileBytes(files: string[]): number {
    let total = 0;
    for (const f of files) {
        try {
            total += statSync(f).size;
        } catch {
            // ignore missing files
        }
    }
    return total;
}

/** 把字节数格式化为 KB / MB。 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
