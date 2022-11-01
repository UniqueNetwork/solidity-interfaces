import { defineConfig, Options } from 'tsup'

const coreOptions: Options = {
  entry: {
    index: "src/index.ts",
  },
  target: 'es2020',
  dts: true,
  sourcemap: true,
  metafile: true,
}

export default defineConfig([
  {
    name: 'main',
    ...coreOptions,
    format: ['esm', 'cjs'],
    splitting: true,
    external: [/^ethers/],
  },

  {
    name: 'main-iife',
    ...coreOptions,
    format: ['iife'],
    splitting: false,
    noExternal: [/.*/],
    platform: 'browser'
  },
])
