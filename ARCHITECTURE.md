# split-font-cli · 技术方案

> 版本：v0.1.0 · 最近更新：2026-05-30
>
> 配套项目：`/Users/xiezhoulin/workspace/fonts` 字体切片方案的 CLI 化产品形态。

---

## 一、立项背景

### 1.1 现状回顾

姊妹项目 `fonts/` 已经跑通了「中日文可变字体（VF）按 Unicode 区段切片 → woff2 → CDN 分发」的完整链路（详见 [`fonts/ARCHITECTURE.md`](../fonts/ARCHITECTURE.md)），但当前实现存在两处明显短板：

| 痛点           | 表现                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **写死的常量** | `src/split.mjs` 顶部 `const lang = "cn"; const fontName = "..."` 需要手工切换；多语言/多字体批量切片需要反复改文件 |
| **零类型约束** | 纯 `.mjs` 实现，配置项无补全、无类型校验，新接入业务方需要逐行读源码理解参数                                       |
| **不可复用**   | 脚本绑定在仓库目录里，其他项目要复用需要把整段代码复制粘贴过去                                                     |
| **能力分散**   | `range.mjs`（生成切片规则）与 `split.mjs`（执行切片）之间靠 `mv` 接力，工作流割裂                                  |

### 1.2 目标

将上述切片能力**封装为一个可独立分发的命令行工具 `split-font-cli`**，对外提供：

1. **稳定的 CLI 命令**：`split-font range`、`split-font split`、`split-font run`。
2. **类型安全的库 API**：导出 `splitFont`、`parseUnicodeRange` 等函数，供 Node 脚本编程调用。
3. **配置文件驱动**：支持 `split-font.config.{ts,js,json}`，一次定义多任务，批量执行。
4. **完整类型定义**：用 TypeScript 编写，发布带 `.d.ts`，IDE 全链路补全。
5. **Node 18 LTS 兼容**：覆盖团队所有线上构建环境。

### 1.3 非目标（Out of Scope）

- ❌ 不替换 `cn-font-split` 自己重写子集化引擎（继续直接复用其 WASM）。
- ❌ 不内置 CDN 上传逻辑（继续走 `@hg/cmd-publish-oss`，本 CLI 只负责"产物落盘"那一步）。
- ❌ 不做 GUI / Web Playground。
- ❌ 不处理非中日韩文字体（拉丁字体直接 `@font-face` 即可，不在场景内）。

---

## 二、产品形态

### 2.1 安装

```bash
# 全局
pnpm add -g split-font-cli

# 项目内
pnpm add -D split-font-cli
```

### 2.2 命令行接口

```text
split-font <command> [options]

Commands:
  range    从 Google Fonts CSS 解析 unicode-range，输出切片规则 JSON
  split    根据切片规则将 TTF 切成 woff2 + CSS
  run      读取配置文件，按顺序批量执行切片任务
  init     在当前目录生成示例配置文件

Global Options:
  -c, --config <path>   指定配置文件路径
  -v, --verbose         显示详细日志
  --silent              静默模式，仅输出错误
  -h, --help            查看帮助
  --version             查看版本号
```

#### 2.2.1 `split-font range`

```bash
split-font range \
  --input ./google-cn.css \
  --output ./ranges-cn.json \
  [--pretty]
```

| 参数           | 类型    | 默认                  | 说明                                          |
| -------------- | ------- | --------------------- | --------------------------------------------- |
| `-i, --input`  | string  | **必填**              | Google Fonts 提供的 `@font-face` CSS 文件路径 |
| `-o, --output` | string  | 与 input 同名 `.json` | 切片规则输出路径                              |
| `--pretty`     | boolean | `true`                | 是否格式化 JSON（缩进 2 空格）                |

#### 2.2.2 `split-font split`

```bash
split-font split \
  --font ./assets/SourceHanSansCN-VF.ttf \
  --ranges ./assets/ranges-cn.json \
  --out ./output \
  --name SourceHanSansCN-VF \
  [--target woff2] \
  [--hash 6] \
  [--font-feature false] \
  [--reporter false]
```

| 参数                    | 类型    | 默认               | 说明                                     |
| ----------------------- | ------- | ------------------ | ---------------------------------------- |
| `-f, --font`            | string  | **必填**           | 源 TTF 字体文件路径                      |
| `-r, --ranges`          | string  | **必填**           | `range` 命令产出的切片规则 JSON          |
| `-o, --out`             | string  | `./output`         | 产物输出目录（最终落到 `<out>/<name>/`） |
| `-n, --name`            | string  | 由 font 文件名推导 | 输出文件名与 `font-family`               |
| `--target`              | enum    | `woff2`            | 产物格式：`woff2` \| `woff` \| `ttf`     |
| `--hash <len>`          | number  | `6`                | 文件名中的内容哈希长度，0 表示关闭       |
| `--font-feature`        | boolean | `false`            | 是否保留 OpenType features               |
| `--subset-remain-chars` | boolean | `false`            | 是否为未覆盖字符生成兜底子集             |
| `--reporter`            | boolean | `false`            | 是否生成可视化体积报表                   |
| `--test-html`           | boolean | `false`            | 是否产出 `test.html` 验证页              |

#### 2.2.3 `split-font run`

```bash
split-font run [--config split-font.config.ts]
```

读取配置文件，按声明顺序依次跑完所有任务，是日常工作的主入口。

#### 2.2.4 `split-font init`

```bash
split-font init [--ts | --js | --json]
```

向当前目录写入 `split-font.config.ts`（默认）/ `.js` / `.json` 模板，并在 `package.json` 中注入推荐的 `scripts`。

### 2.3 配置文件

支持以下格式（优先级从高到低）：

1. `split-font.config.ts`
2. `split-font.config.js`（ESM / CJS 皆可）
3. `split-font.config.json`
4. `package.json` 中的 `"split-font"` 字段

类型签名：

```typescript
import { defineConfig } from "split-font-cli";

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
        {
            name: "SourceHanSansJP-VF",
            font: "./assets/font/SourceHanSansJP-VF.ttf",
            ranges: "./assets/ranges-jp.json",
        },
    ],
});
```

`run` 命令会读取 `tasks[]`，逐个调用 `split`，相当于 `fonts/` 项目里一次性切完 CN + JP。

### 2.4 库（编程式）API

```typescript
import { splitFont, parseUnicodeRangeCss, defineConfig } from "split-font-cli";

await splitFont({
    font: "./SourceHanSansCN-VF.ttf",
    ranges: "./ranges-cn.json",
    outDir: "./output",
    name: "SourceHanSansCN-VF",
});

const rangesMap = await parseUnicodeRangeCss("./google-cn.css");
```

便于在 Node 脚本或 CI 中直接调用，跳过 CLI 解析层。

---

## 三、技术栈

| 维度     | 选型                               | 理由                                                       |
| -------- | ---------------------------------- | ---------------------------------------------------------- |
| 语言     | TypeScript 5.4 +                   | 类型安全，团队基建标配                                     |
| 运行时   | Node.js 18.x（LTS）                | 用户要求；同时兼容 20.x / 22.x                             |
| 模块格式 | ESM（`"type": "module"`）          | `cn-font-split` 仅提供 ESM；新项目首选 ESM                 |
| 构建工具 | `tsup`（基于 esbuild）             | 一条命令同时产 ESM + `.d.ts`，比裸 `tsc` 简单              |
| CLI 框架 | `commander@12`                     | API 稳定，子命令/帮助文本/类型化选项支持完善，零运行时依赖 |
| 配置加载 | `tsx`（仅 dev）+ `jiti`（runtime） | `jiti` 让 `.ts` 配置在 Node 18 下也能即时执行              |
| 日志     | `picocolors` + 内置 logger         | 极小体积，无样式逃生序列时自动降级                         |
| 测试     | `vitest`（可选）                   | 与 vite/esbuild 生态一致，本项目可后续增量补充             |
| Lint     | `eslint` + `@typescript-eslint`    | 团队默认                                                   |
| 私有源   | `.npmrc` 走 `xxxx`                 | 与 `fonts/` 项目一致，便于内部分发                         |

### Node 18 兼容性约束

| 能力                                 | Node 18 状态     | 选择                                                             |
| ------------------------------------ | ---------------- | ---------------------------------------------------------------- |
| ESM 顶层 await                       | ✅               | 直接用                                                           |
| `import.meta.url`                    | ✅               | 取 `__dirname` 用 `fileURLToPath(new URL('.', import.meta.url))` |
| `import.meta.dirname`                | ❌（20.11+）     | **禁用**                                                         |
| `import ... assert { type: 'json' }` | ⚠️ 实验          | 改用 `createRequire` + `require(json)` 或 `fs.readFile`          |
| `fetch` 全局                         | ✅ 18.0+         | 可用                                                             |
| `node:test`                          | ⚠️ 18.x 部分 API | 测试改用 `vitest`                                                |
| `structuredClone`                    | ✅               | 可用                                                             |

---

## 四、目录结构

```text
split-font-cli/
├── README.md
├── ARCHITECTURE.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .editorconfig
├── .npmrc
├── .gitignore
│
├── src/
│   ├── index.ts                 # 库导出入口（exports.”.“）
│   ├── cli.ts                   # 可执行入口（exports.”./cli“ + bin）
│   │
│   ├── commands/
│   │   ├── range.ts             # `split-font range`
│   │   ├── split.ts             # `split-font split`
│   │   ├── run.ts               # `split-font run`
│   │   └── init.ts              # `split-font init`
│   │
│   ├── core/
│   │   ├── range-parser.ts      # 解析 Google CSS → ranges JSON
│   │   ├── font-splitter.ts     # 包装 cn-font-split，落盘
│   │   └── config-loader.ts     # 加载 .ts/.js/.json 配置
│   │
│   ├── utils/
│   │   ├── logger.ts            # 带 verbose / silent 等级的日志
│   │   ├── fs.ts                # 通用 fs 助手（safe-mkdir / read-json 等）
│   │   └── paths.ts             # __dirname、cwd resolve 等
│   │
│   ├── templates/
│   │   ├── config.ts.tpl
│   │   └── config.json.tpl
│   │
│   └── types.ts                 # 公共类型 (TaskConfig / RootConfig / RangeMap …)
│
└── dist/                        # tsup 产物（不入仓）
    ├── index.js / .d.ts
    └── cli.js
```

---

## 五、核心模块设计

### 5.1 `core/range-parser.ts`

**职责**：解析 Google Fonts 提供的 `@font-face` CSS，输出形如 `{ "[0]": ["U+4e00", ...], "[1]": [...] }` 的 ranges 映射。完全等价于 `fonts/src/range.mjs`，但：

- 拆出纯函数 `parseUnicodeRangeCss(cssText: string): RangeMap`，方便测试与库式调用。
- 入参支持 `string`（路径）/ `Buffer` / `URL`，自动判别。
- 错误处理改为抛 `RangeParseError`（继承自 `Error`），CLI 层统一捕获并退出码 1。
- 边界 case：
    - CSS 注释段 ID 缺失时，按出现顺序生成 `[seq:0]`、`[seq:1]`。
    - 单 `U+xxxx`（无 `-`）保留原值不展开。
    - 全文未匹配到任何 `unicode-range`，抛错而非返回 null（语义更清晰）。

### 5.2 `core/font-splitter.ts`

**职责**：把任务级配置 `TaskConfig` 翻译成 `cn-font-split` 的入参，封装产物落盘。

```typescript
export interface SplitFontOptions {
    font: string; // TTF 路径
    ranges: string | RangeMap; // ranges 文件路径或已加载 map
    outDir: string; // 输出目录（最终落到 <outDir>/<name>/）
    name?: string; // 默认从 font 文件名推导
    target?: "woff2" | "woff" | "ttf";
    hash?: number; // 0 表示禁用
    fontFeature?: boolean;
    subsetRemainChars?: boolean;
    reporter?: boolean;
    testHtml?: boolean;
    logger?: Logger;
}

export async function splitFont(opts: SplitFontOptions): Promise<SplitResult>;
```

实现要点：

1. **入参规范化**：把路径转 absolute；ranges 若是文件路径则 `readFile + JSON.parse`。
2. **失败前置校验**：font 文件不存在、ranges 为空、`outDir` 不可写时，直接抛错避免半成品产物。
3. **复用 fonts 项目的最佳实践**：默认值与 `fonts/src/split.mjs` 完全对齐（`fontFeature=false`、`reduceMins=false`、`subsetRemainChars=false`、`renameOutputFont=<name>.[hash:6].[ext]`），保证现有产物哈希策略不变。
4. **返回值**：把 `result.css` 路径、产出 woff2 文件数量、总字节数返回，供 `run` 命令打印汇总。

### 5.3 `core/config-loader.ts`

**职责**：定位、加载并校验配置文件。

| 步骤                | 实现                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 文件查找            | `--config` 指定优先；否则依次找 `split-font.config.{ts,js,mjs,cjs,json}`；最后看 `package.json#split-font`                          |
| TS 配置加载         | 使用 `jiti({ interopDefault: true, esmResolve: true })` 即时加载 `.ts`，避免要求用户额外装 `ts-node`                                |
| JSON 加载           | `JSON.parse(readFileSync(...))`                                                                                                     |
| 校验                | 用纯手写 `assertConfig` 守卫（不引入 zod，保持依赖体量）：必填 `tasks: TaskConfig[]`、`task.name` 非空、`task.font/ranges` 文件存在 |
| `defineConfig` 帮手 | 仅做类型推导透传，运行时直接返回原对象，零开销                                                                                      |

### 5.4 `commands/*`

**职责**：把 CLI flags 翻译成 `core/` 的函数调用，并负责日志与退出码。

每个命令文件导出：

```typescript
export function registerXxxCommand(program: Command, ctx: CliContext): void;
```

由 `cli.ts` 的总入口统一注册到 `commander` 实例。这样：

- 子命令之间互相解耦。
- 单元测试可以直接 `import { run } from "./commands/range.js"; run({...})` 跳过 commander。

### 5.5 `utils/logger.ts`

一个轻量级 Logger：

```typescript
class Logger {
    constructor(level: "silent" | "info" | "verbose" = "info") {}
    info(msg: string): void;
    success(msg: string): void;
    warn(msg: string): void;
    error(msg: string | Error): void;
    debug(msg: string): void; // 仅 verbose 输出
    time(label: string): void; // 包装 console.time
    timeEnd(label: string): void;
}
```

- 颜色用 `picocolors`，体积仅 ~1KB。
- 非 TTY 环境（CI）自动关闭颜色。

---

## 六、数据流

### 6.1 `range` 命令

```text
Google CSS ──► fs.readFile
                  │
                  ▼
        parseUnicodeRangeCss()
                  │
                  ▼
            RangeMap (Record<string, string[]>)
                  │
                  ▼
         JSON.stringify + writeFile
                  │
                  ▼
            ranges-<lang>.json
```

### 6.2 `split` 命令

```text
TTF ──► fs.readFile (Buffer)
                │
                ▼
RangeMap ─► toCodepointArrays()  ──► number[][]
                │
                ▼
         cn-font-split.fontSplit({
             input, subsets, outDir,
             targetType="woff2",
             renameOutputFont="<name>.[hash:6].[ext]",
             ...
         })
                │
                ▼
        output/<name>/<name>.<hash>.woff2 × N
        output/<name>/result.css
```

### 6.3 `run` 命令

```text
split-font.config.ts ──► jiti.import()
                              │
                              ▼
                       assertConfig()
                              │
                              ▼
                       for task of tasks:
                          ├─► splitFont(task)
                          └─► 打印体积统计
                              │
                              ▼
                        全任务汇总报表
```

---

## 七、错误处理与退出码

| 退出码 | 场景                                           |
| ------ | ---------------------------------------------- |
| `0`    | 全部成功                                       |
| `1`    | 业务错误（参数不合法、找不到文件、解析失败等） |
| `2`    | 系统错误（fs 失败、cn-font-split 内部抛错）    |

所有自定义错误继承自 `CliError`，CLI 顶层捕获后：

- `verbose` 模式打印完整堆栈；
- 默认模式仅打印 `error.message` + 命令名。

---

## 八、与 `fonts/` 项目的迁移指南

`fonts/` 项目接入本 CLI 后只需保留 `src/assets/`，删除 `src/split.mjs`、`src/range.mjs`，改写 `package.json`：

```json
{
    "scripts": {
        "range": "split-font range -i src/assets/google-cn.css -o src/assets/ranges-cn.json",
        "split": "split-font run",
        "upload": "cmd-publish-oss",
        "serve": "serve ./html -p 80"
    },
    "devDependencies": {
        "split-font-cli": "^0.1.0"
    }
}
```

并在根目录新增 `split-font.config.ts`：

```typescript
import { defineConfig } from "split-font-cli";

export default defineConfig({
    outDir: "./output",
    tasks: [
        {
            name: "SourceHanSansCN-VF",
            font: "./src/assets/font/SourceHanSansCN-VF.ttf",
            ranges: "./src/assets/ranges-cn.json",
        },
        {
            name: "SourceHanSansJP-VF",
            font: "./src/assets/font/SourceHanSansJP-VF.ttf",
            ranges: "./src/assets/ranges-jp.json",
        },
    ],
});
```

---

## 九、开发与发布

### 9.1 本地开发

```bash
pnpm install
pnpm dev          # tsup --watch，实时产物在 dist/
pnpm build        # 一次性构建
node ./dist/cli.js split --help   # 本地试用
pnpm link --global               # 在系统里挂 split-font 命令
```

### 9.2 NPM 发布

```bash
pnpm build
pnpm publish --access public --registry=xxxx
```

`package.json` 关键字段：

```json
{
    "name": "split-font-cli",
    "version": "0.1.0",
    "type": "module",
    "bin": { "split-font": "./dist/cli.js" },
    "exports": {
        ".": {
            "import": "./dist/index.js",
            "types": "./dist/index.d.ts"
        }
    },
    "engines": { "node": ">=18.0.0" },
    "files": ["dist", "README.md"]
}
```

### 9.3 版本策略

遵循 SemVer：

- `v0.x` 阶段允许 minor 含 breaking（配合 CHANGELOG）；
- 接入 `fonts/` 项目稳定后切到 `v1.0.0`，此后严格 SemVer。

---

## 十、里程碑

| 里程碑           | 范围                                              | 产出                                     |
| ---------------- | ------------------------------------------------- | ---------------------------------------- |
| **M0**（本提交） | 项目骨架 + range/split/run/init 4 个命令 + 库 API | 可本地运行，能完整跑通 `fonts/` 现有任务 |
| **M1**           | 自动化测试（vitest）+ CI（GitHub Actions）        | 单元测试 + 集成测试覆盖                  |
| **M2**           | 内置上传插件（可选 `cmd-publish-oss` 适配）       | `split-font upload` 子命令               |
| **M3**           | 切片质量监控（Puppeteer 截图对比 + 子集命中分析） | `split-font verify` 子命令               |

---

## 十一、参考

- 姊妹项目：`fonts/`（`ARCHITECTURE.md` & `src/`）
- `cn-font-split`：<https://github.com/KonghaYao/cn-font-split>
- `commander.js`：<https://github.com/tj/commander.js>
- `tsup`：<https://tsup.egoist.dev/>
- `jiti`：<https://github.com/unjs/jiti>
