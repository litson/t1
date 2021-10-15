/**
 * @file  从Vue-SFC style 块中提取 theme={target} 代码块，
 *          并创建一个新的style块来存放他们
 */
import { clone } from 'ramda'
import { parseComponent } from 'vue-template-compiler'
import stylus from 'stylus'
import type {
  SFCBlock,
  SFCDescriptor,
} from 'vue-template-compiler/types/index'
import postcss, {
  Rule,
  Declaration,
  Root,
  Comment,
} from 'postcss'
import { serializeSFC } from './utils'

export default async function (content: string) {
  const callback = this.async()
  this.cacheable && this.cacheable()
  const sfc: SFCDescriptor = parseComponent(content)
  try {
    const result = await warpper(sfc, content)
    callback(null, result)
  } catch (e) {
    callback(e)
  }
}

async function warpper(
  sfc: SFCDescriptor,
  content: string
) {
  let isModified = false
  await Promise.all(
    sfc.styles.map(async ($block: SFCBlock) => {
      let { content } = $block
      const { attrs } = $block
      // 处理stylus
      if (attrs.lang && attrs.lang === 'stylus') {
        content = await new Promise((resolve, reject) =>
          stylus(content).render((err, css) =>
            err ? reject(err) : resolve(css)
          )
        )
      }
      // TODO 处理less/scss..etc
      const { styleBlocks, newContent } = extractSkinCode(
        content,
        attrs
      )
      $block.content = newContent
      if (styleBlocks) {
        isModified = true
        styleBlocks.forEach((c) => {
          sfc.styles.push(createStyleBlock($block, c))
        })
      }
    })
  )
  // 没变化就不改变原内容
  return isModified ? serializeSFC(sfc) : content
}

/**
 * 创建一个SFC的style块
 */
function createStyleBlock(o, source) {
  o = clone(o)
  for (const k in source) {
    // if (o.hasOwnProperty(k)) {
    if (
      Object.prototype.toString.call(source[k]) ===
      '[Object object]'
    ) {
      o[k] = createStyleBlock(o[k], source[k])
    } else {
      o[k] = source[k]
    }
    // }
  }
  return o
}

/**
 * 提取样式中指定的皮肤行内代码
 */
interface ExtraResult {
  newContent: string
  styleBlocks: SFCBlock[]
}

import { THEME_REG_EXP as REG } from './utils'
function extractSkinCode(css: string, attrs): ExtraResult {
  const root: Root = postcss.parse(css)
  const styleBlocks: SFCBlock[] = []
  let current: DContainer | null = null

  root.walk((node) => {
    const { type, text } = node as Comment

    if ((type as string) === 'comment') {
      const matches = text.trim().match(REG)
      if (matches) {
        const { selector, selectors, raws } =
          node.parent as Rule
        current = createContainer(matches[1], {
          selector,
          selectors,
          raws,
        })
        node.remove()
      }

      if (text.trim() === 'end') {
        styleBlocks.push({
          type: 'style',
          content: current.root.toResult().css,
          attrs: {
            ...attrs,
            theme: current.theme,
          },
        })
        current = null
        node.remove()
      }
    }

    if ((type as string) === 'decl' && current) {
      const { prop, value, important, raws } =
        node as Declaration
      current.rule.append(
        new Declaration({
          prop,
          value,
          important,
          raws,
        })
      )
      node.remove()
    }
  })

  return {
    newContent: root.toResult().css,
    styleBlocks,
  }
}

interface DContainer {
  root: Root
  rule: Rule
  theme: string
}

/**
 * 创建一个新的AST容器
 */
function createContainer(
  theme: string,
  { selector, selectors, raws }
): DContainer {
  const root: Root = new Root()
  const rule: Rule = new Rule({
    selector,
    selectors,
    raws,
  })
  root.append(rule)
  return {
    root,
    rule,
    theme,
  }
}
