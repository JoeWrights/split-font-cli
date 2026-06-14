# split-font-cli

> 把中日韩可变字体（VF）按 Unicode 区段切片成 woff2 + CSS 的命令行工具，底层基于 [`cn-font-split`](https://github.com/KonghaYao/cn-font-split)。
>
> 由内部 `fonts/` 项目沉淀而来，支持 Node.js 18 LTS，使用 TypeScript 编写。

---

## 特性

- 一条命令 `split-font run` 批量切片所有字体；告别"改源码常量切语言"。
- 完整 TypeScript 类型，IDE 全链路补全。
- 支持 `split-font.config.ts` / `.js` / `.json` 三种配置形式。
- 内置 `range` 子命令复用 Google Fonts 切片粒度，免去自己分组的算法工作。
- 库式 API（`import { splitFont } from "split-font-cli"`），便于在 CI/CD 脚本里嵌入。

## 安装

```bash
# 全局
pnpm add -g split-font-cli

# 项目内
pnpm add -D split-font-cli
```

## 快速上手

### 1. 生成示例配置

```bash
split-font init
```

会在当前目录生成 `split-font.config.ts`。

### 2. 准备切片规则

如果还没有 `ranges-*.json`，先从 Google Fonts CSS 解析：

```bash
split-font range \
    --input ./assets/google-cn.css \
    --output ./assets/ranges-cn.json
```

> Google Fonts CSS 可以通过 `https://fonts.googleapis.com/css?family=Noto+Sans+SC&display=swap` 获取并保存到本地。

### 3. 一次性切完所有字体

```bash
split-font run
```

产物会落到 `<outDir>/<name>/`，每个字体目录下包含若干 woff2 与一份聚合 `result.css`。

### 4. 单个字体临时切片

```bash
split-font split \
    --font ./SourceHanSansCN-VF.ttf \
    --ranges ./ranges-cn.json \
    --name SourceHanSansCN-VF \
    --out ./output
```

## 配置文件

`split-font.config.ts` 示例：

```typescript
import { defineConfig } from "split-font-cli";

export default defineConfig({
    outDir: "./output",
    cdn: {
        prefix: "xxxx",
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

### 任务字段一览

| 字段                | 类型                             | 默认值               | 说明                           |
| ------------------- | -------------------------------- | -------------------- | ------------------------------ |
| `name`              | `string`                         | 由 `font` 文件名推导 | 输出文件名与 `font-family`     |
| `font`              | `string`                         | **必填**             | 源 TTF/OTF 路径                |
| `ranges`            | `string \| RangeMap`             | **必填**             | ranges JSON 路径或已加载的 map |
| `target`            | `"woff2"` \| `"woff"` \| `"ttf"` | `"woff2"`            | 产物格式                       |
| `hash`              | `number`                         | `6`                  | 内容哈希长度，0 关闭           |
| `fontFeature`       | `boolean`                        | `false`              | 保留 OpenType features         |
| `subsetRemainChars` | `boolean`                        | `false`              | 为未覆盖字符生成兜底子集       |
| `reporter`          | `boolean`                        | `false`              | 产出体积报表                   |
| `testHtml`          | `boolean`                        | `false`              | 产出测试 HTML                  |
| `languageAreas`     | `boolean`                        | `false`              | 启用语言区自动切分             |
| `autoSubset`        | `boolean`                        | `false`              | 启用自动子集化                 |
| `reduceMins`        | `boolean`                        | `false`              | 启用字形压缩                   |

> 默认值与社区项目 `fonts/` 完全对齐，可平滑迁移。

## 库式 API

```typescript
import { splitFont, parseUnicodeRangeFile, defineConfig } from "split-font-cli";

const ranges = await parseUnicodeRangeFile("./assets/google-cn.css");

await splitFont(
    {
        name: "MyFont-VF",
        font: "./assets/MyFont-VF.ttf",
        ranges,
    },
    "./output",
);
```

## 命令一览

| 命令                                            | 用途                               |
| ----------------------------------------------- | ---------------------------------- |
| `split-font init [--ts \| --js \| --json]`      | 生成示例配置文件                   |
| `split-font range -i <css> -o <json>`           | 解析 Google Fonts CSS 生成切片规则 |
| `split-font split -f <ttf> -r <json> -n <name>` | 单次切片，命令行临时调试           |
| `split-font run [-c <config>]`                  | 读取配置文件批量执行（推荐）       |

全局开关：

```text
-v, --verbose   显示详细日志（debug + 计时）
--silent        静默模式，仅输出错误
-V, --version   查看版本
-h, --help      查看帮助
```

## 与 `fonts/` 项目的对照

| `fonts/`                                               | `split-font-cli`                          |
| ------------------------------------------------------ | ----------------------------------------- |
| 修改 `src/split.mjs` 顶部 `lang/fontName` 常量         | 编辑 `split-font.config.ts` 的 `tasks[]`  |
| `pnpm range` + 手动 `mv tmp/ranges-*.json src/assets/` | `split-font range -i ... -o ...` 一步到位 |
| `pnpm split`（每次切一种字体）                         | `split-font run`（一次切完所有）          |
| 编辑源码切换语言                                       | 在配置文件里增删任务                      |

## Node.js 兼容

- 严格兼容 Node.js 18.x（LTS）。
- 也在 Node 20.x / 22.x 上测试通过。

## License

MIT
