import { chmod } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        cli: "src/cli.ts",
    },
    format: ["esm"],
    target: "node18",
    platform: "node",
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    shims: false,
    minify: false,
    treeshake: true,
    outDir: "dist",
    esbuildOptions(options) {
        options.legalComments = "none";
    },
    async onSuccess() {
        const cliPath = path.resolve("dist/cli.js");
        try {
            await chmod(cliPath, 0o755);
        } catch {
            // ignore: dist/cli.js may not exist on the very first watch tick
        }
    },
});
