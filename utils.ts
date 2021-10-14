import type {
  SFCBlock,
  SFCDescriptor,
} from 'vue-template-compiler/types/index'
import type { Compiler } from 'webpack'
import path from 'path'

export const getWebpack = (compiler: Compiler) => {
  return compiler.webpack
    ? compiler.webpack
    : require('webpack')
}
export const isWebpack4 = (compiler: Compiler) =>
  compiler.webpack
    ? false
    : typeof compiler['resolvers'] !== 'undefined'

export const THEME_REG_EXP = /^theme=(.*)/i
export const isThemeID: (T: string) => boolean = (T) =>
  THEME_REG_EXP.test(T)

/**
 * SFC描述 => 模板字符串
 * @todo
 *          1. SFC setup优化中，script在scriptSetup中，
 *          2. 改用：@vue/compiler-sfc解析
 */
export function serializeSFC(sfc: SFCDescriptor): string {
  return `${parseTemplate(sfc.template)}${parseTemplate(
    sfc.script
  )}${parseTemplate(sfc.styles)}${parseTemplate(
    sfc.customBlocks
  )}`
}

function parseTemplate(
  $block: SFCBlock | SFCBlock[]
): string {
  if (!$block) {
    return ''
  }
  if (Array.isArray($block)) {
    return $block.map(($b) => parseTemplate($b)).join('')
  }
  const tag = $block.type
  const attrs = []
  for (const k in $block.attrs) {
    attrs.push(`${k}="${$block.attrs[k]}"`)
  }
  return `<${tag} ${attrs.join(' ')}>${
    $block.content
  }</${tag}>`
}

export function safeRequire(moduleName: string) {
  const paths = [
    process.env.NODE_ENV === 'test'
      ? path.resolve(__dirname, '../__tests__/webpack')
      : process.cwd(),
    ...require.resolve.paths(moduleName),
  ]

  return require(require.resolve(moduleName, {
    paths,
  }))
}

import qs from 'querystring'

export interface VueQuery {
  vue?: boolean
  src?: boolean
  type?: 'script' | 'template' | 'style' | 'custom'
  index?: number
  lang?: string
  raw?: boolean
}

export function parseVueRequest(id: string): {
  filename: string
  query: VueQuery
} {
  const [filename, rawQuery] = id.split(`?`, 2)
  const query = qs.parse(rawQuery) as VueQuery
  if (query.vue != null) {
    query.vue = true
  }
  if (query.src != null) {
    query.src = true
  }
  if (query.index != null) {
    query.index = Number(query.index)
  }
  if (query.raw != null) {
    query.raw = true
  }
  return {
    filename,
    query,
  }
}
