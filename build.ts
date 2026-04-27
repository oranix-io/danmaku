import 'dotenv/config';
import { context as createContext, BuildOptions } from 'esbuild';
import mri from 'mri';
import { resolve } from 'path';
import { builtinModules } from 'node:module';
import { buildStat } from 'scripts/build/plugins';
import { getEsbuildAlias } from 'scripts/build/alias';

const argv = mri(process.argv.slice(2));

const define = {
  'process.env.NODE_ENV': JSON.stringify(
    argv.watch ? 'development' : 'production'
  ),
} as Record<string, string>;

export const buildParams = {
  minify: false,
  color: true,
  loader: {
    '.html': 'text',
    '.svg': 'text',
  },
  bundle: true,
  outdir: 'dist',
  outbase: '.',
  logLevel: 'info',
  metafile: true,
  external: ['electron', ...builtinModules.flatMap((m) => [m, `node:${m}`])],
  define,
  plugins: [buildStat()].filter(Boolean),
  alias: getEsbuildAlias(),
} as BuildOptions;

async function buildMain() {
  const context = await createContext({
    ...buildParams,
    entryPoints: [resolve(__dirname, 'main/index.ts')],
    platform: 'node',
    target: 'node20',
    format: 'cjs',
  });

  if (argv['watch']) {
    await context.watch();
  } else {
    await context.rebuild();
    context.dispose();
  }
}
async function buildPreload() {
  const preloadScripts = {
    index: 'preload/index.ts',
    danmaku: 'preload/danmaku/index.ts',
  };

  const context = await createContext({
    ...buildParams,
    entryPoints: [
      ...Object.values(preloadScripts).map((v) => resolve(__dirname, v)),
    ],
    platform: 'node',
    target: 'node20',
    format: 'iife',
  });

  if (argv['watch']) {
    context.watch();
  } else {
    await context.rebuild();
    context.dispose();
  }
}

async function main() {
  await Promise.all([buildMain(), buildPreload()]);
}

main();
