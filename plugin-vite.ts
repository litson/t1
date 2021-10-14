import { PLUGIN_ID } from './const'
import { parseVueRequest } from './utils'
import {
  SFCBlock,
  SFCScriptCompileOptions,
  SFCStyleCompileOptions,
  SFCTemplateCompileOptions,
} from '@vue/compiler-sfc'

export default function DfluxThemeLoaderPlugin(options) {
  return {
    name: 'vite-plugin-vue-themify',
    buildEnd() {
      // debugger
      console.log(this)
    },
    load,
    transform,
    enforce: 'post',
  }
}

async function resolveId(id) {
  console.log('resolveId', id)
  if (parseVueRequest(id).query.vue) {
    return id
  }
}

/**
 * !找到符合皮肤规则的『模块』
 *    1. query.vue
 *    2. query
 **/
function load(id) {
  const { filename, query } = parseVueRequest(id)
  if (query.vue) {
    console.log('load', id)
    let block: SFCBlock | null | undefined
  }

  return null
}

function transform(code, id) {
  // debugger
  const { filename, query } = parseVueRequest(id)
  if (!query.vue) {
    return
  }
  return
}
