import { promises as fsp } from "node:fs";

import { RangeParseError } from "./errors.js";
import type { RangeMap } from "../types.js";

/**
 * 与 `fonts/src/range.mjs` 一致的注释段名正则。
 * 形如 `/* [4] *\/`、`/* [latin-ext] *\/`、`/* cyrillic *\/`。
 */
const ID_REGEX = /\/\*\s*([^*]+?)\s*\*\//g;

/**
 * `unicode-range: U+xxxx, U+xxxx-xxxx, ...;` 的提取正则。
 */
const RANGE_REGEX = /unicode-range\s*:\s*([^;]+);/gi;

/** 用于把单个 `U+xxxx` 或 `U+xxxx-yyyy` 区间展开成离散码点。 */
const RANGE_ITEM_REGEX = /U\+([0-9A-F]+)(?:-([0-9A-F]+))?/i;

/**
 * 直接对 CSS 字符串做解析，返回 RangeMap。
 *
 * 解析策略：
 * 1. 按出现顺序两两交错抽取「段名注释」与「unicode-range 声明」，
 *    一一对应作为 key/value。
 * 2. 区间 `U+xxxx-yyyy` 展开为每个码点 `U+x`，与 fonts/src/range.mjs 行为一致；
 *    单 `U+xxxx` 保留原值不展开。
 *
 * 边界处理：
 * - 段名缺失时，按 `seq:<index>` 自动生成。
 * - 整段未匹配到任何 unicode-range，抛 RangeParseError。
 */
export function parseUnicodeRangeCss(cssText: string): RangeMap {
    const flat = cssText.replace(/\r?\n/g, "");

    const ids: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = ID_REGEX.exec(flat)) !== null) {
        ids.push(m[1] ?? "");
    }

    const ranges: string[] = [];
    while ((m = RANGE_REGEX.exec(flat)) !== null) {
        ranges.push((m[1] ?? "").replace(/\s+/g, ""));
    }

    if (ranges.length === 0) {
        throw new RangeParseError("未在 CSS 中找到任何 unicode-range 声明");
    }

    const result: RangeMap = {};
    for (let i = 0; i < ranges.length; i++) {
        const id = ids[i] ?? `seq:${i}`;
        const rangeStr = ranges[i];
        if (!rangeStr) continue;
        result[id] = expandUnicodeRange(rangeStr);
    }

    return result;
}

/**
 * 从文件路径读取并解析。Node 18 全平台兼容。
 */
export async function parseUnicodeRangeFile(
    filePath: string
): Promise<RangeMap> {
    let raw: string;
    try {
        raw = await fsp.readFile(filePath, "utf-8");
    } catch (err) {
        throw new RangeParseError(
            `读取 CSS 文件失败：${filePath}\n${(err as Error).message}`
        );
    }
    return parseUnicodeRangeCss(raw);
}

/**
 * 把 `unicode-range` 一行的字面值（如 `U+4e00,U+4e01-4e0a`）展开为字符串数组。
 * 公开导出，便于单测与库式调用。
 */
export function expandUnicodeRange(rangeLiteral: string): string[] {
    const items = rangeLiteral.split(",");
    const out: string[] = [];
    for (const itemRaw of items) {
        const item = itemRaw.trim();
        if (!item) continue;

        if (!item.includes("-")) {
            out.push(item);
            continue;
        }

        const m = RANGE_ITEM_REGEX.exec(item);
        if (!m || !m[1] || !m[2]) {
            out.push(item);
            continue;
        }
        const start = Number.parseInt(m[1], 16);
        const end = Number.parseInt(m[2], 16);
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
            throw new RangeParseError(`非法 unicode-range 区间：${item}`);
        }
        for (let cp = start; cp <= end; cp++) {
            out.push(`U+${cp.toString(16)}`);
        }
    }
    return out;
}

/**
 * 把 RangeMap 转成 cn-font-split 接受的 `number[][]` 子集数组：
 * 每一段 ["U+4e00", "U+4e01", ...] -> [0x4e00, 0x4e01, ...]。
 *
 * 拒绝非法码点（NaN）并抛错，便于在调用 fontSplit 之前提前发现脏数据。
 */
export function rangeMapToSubsets(map: RangeMap): number[][] {
    const subsets: number[][] = [];
    for (const [segId, codepoints] of Object.entries(map)) {
        if (!Array.isArray(codepoints)) {
            throw new RangeParseError(
                `RangeMap 段 "${segId}" 的值不是数组`
            );
        }
        const numericArray: number[] = [];
        for (const cp of codepoints) {
            const numeric = parseUnicodeLiteral(cp);
            if (Number.isNaN(numeric)) {
                throw new RangeParseError(
                    `RangeMap 段 "${segId}" 包含非法码点：${cp}`
                );
            }
            numericArray.push(numeric);
        }
        subsets.push(numericArray);
    }
    return subsets;
}

/** 把 `U+xxxx` 字符串解析为数字码点。 */
export function parseUnicodeLiteral(literal: string): number {
    if (typeof literal !== "string") return Number.NaN;
    const trimmed = literal.trim();
    if (!trimmed.toLowerCase().startsWith("u+")) return Number.NaN;
    return Number.parseInt(trimmed.slice(2), 16);
}
