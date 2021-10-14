/**
 * @file Build
 */
import pkg, { version, name } from './package.json'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import { mergeDeepRight } from 'ramda'

const banner = `/* ${name} at ${version} */`
const external = Object.keys(pkg.dependencies).concat([
  'path',
  'fs',
  'url',
  'querystring',
])
const defaultConfig = {
  output: {
    banner,
    dir: 'dist',
  },
  external,
  plugins: [
    typescript(),
    json(),
    nodeResolve(),
    commonjs({
      extensions: ['.js', '.ts'],
    }),
  ],
}
export default [
  mergeDeepRight(defaultConfig, {
    input: {
      'switch-theme': './src/web/switch-theme.ts',
    },
    output: {
      format: 'esm',
    },
  }),
  mergeDeepRight(defaultConfig, {
    input: {
      'plugin-webpack4': './src/plugin-webpack4.ts',
      'extra-loader': './src/extra-loader.ts',
    },
    output: {
      exports: 'auto',
      format: 'cjs',
      entryFileNames: '[name].js',
    },
  }),
  mergeDeepRight(defaultConfig, {
    input: {
      'plugin-vite': './src/plugin-vite.ts',
    },
    output: {
      exports: 'auto',
      format: 'cjs',
      entryFileNames: '[name].js',
    },
  }),
]
