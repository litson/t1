/**
 * @file 插件webpack4版本
 */
import { Compiler } from 'webpack'
import type {
  Compilation,
  RuleSetRule,
  RuleSetUseItem,
} from 'webpack'
import { PLUGIN_ID } from './const'
import { safeRequire } from './utils'
import { pluginSchema } from './options'
import { unionWith, eqBy, prop } from 'ramda'
import url from 'url'
import path from 'path'
const { validate } = require('schema-utils')
const RuleSet = require('webpack/lib/RuleSet')
let uid = 0

interface IOptions {
  target: string
  expansion: string[]
}

export class DfluxThemeLoaderPlugin {
  private collocation = {}
  public expansion: string[] = []
  public plantforms: string[] = []
  public target: string
  public constructor(options: IOptions) {
    validate(pluginSchema, options)
    // 扩展
    this.target = options.target
    this.expansion = options.expansion
    this.plantforms = options.expansion.concat([
      options.target,
    ])
  }
  public apply(compiler: Compiler) {
    // 插入两个loader，这两个loader要被插入到vue-loader『之前』
    this.insertLoadersBerforeVueLoader(compiler, [
      {
        loader: require.resolve('./extra-loader'),
        options: {},
        // loader.ident
        ident: PLUGIN_ID + uid++,
      },
      {
        loader: require.resolve(
          './copy-theme-style-loader'
        ),
        options: {
          target: this.target,
          expansion: this.expansion,
        },
        // loader.ident
        ident: PLUGIN_ID + uid++,
      },
    ])
    /**
     * 换肤依赖mini-css-extract-plugin，
     * 但是一些项目dev模式并不会引入这个插件
     */
    if (process.env.NODE_ENV !== 'production') {
      this.idempotentAddExtractCss(compiler)
    }
    // 配置 optimization.splitChunks.cacheGroups
    this.generateSplitChunks(compiler)
    // 收集皮肤相关的chunk，并在产出中移除这些chunk的引用
    this.removeThemeDependencies(compiler)
    // 将收集到的chunk pack成一个字典结构，插入到html中
    this.injectToHTML(compiler)
  }
  private findAndModifyLoader(
    compiler: Compiler,
    ext: string,
    modify: (
      loaders: RuleSetUseItem[],
      rule: RuleSetRule
    ) => void | false
  ) {
    const rawRules = compiler.options.module.rules
    const { rules } = new RuleSet(rawRules)
    const ruleIndex = rawRules.findIndex(
      this.createMatcher(`foo${ext}`)
    )
    const rule: RuleSetRule = rules[ruleIndex]
    if (!rule) {
      return false
    }
    const loaders = rule.use as RuleSetUseItem[]
    if (modify(loaders, rule) === false) {
      return false
    }
    return rules
  }
  private insertLoadersBerforeVueLoader(
    compiler: Compiler,
    loaders: RuleSetUseItem[]
  ) {
    const rules = this.findAndModifyLoader(
      compiler,
      '.vue',
      (vueUse) => {
        const vueLoaderUseIndex = vueUse.findIndex(
          (u: { loader: any }) => {
            return /^vue-loader|(\/|\\|@)vue-loader/.test(
              u.loader
            )
          }
        )

        if (vueLoaderUseIndex < 0) {
          return false
        }

        vueUse.splice.apply(
          vueUse,
          [vueLoaderUseIndex + 1, 0].concat(loaders as any)
        )
      }
    )
    if (rules) {
      compiler.options.module.rules = [...rules]
    }
  }
  private createMatcher(fakeFile: string) {
    return (rule: { enforce: any; include: any }) => {
      const clone = Object.assign({}, rule)
      delete clone.include
      const normalized = RuleSet.normalizeRule(
        clone,
        {},
        ''
      )
      return (
        !rule.enforce &&
        normalized.resource &&
        normalized.resource(fakeFile)
      )
    }
  }
  private removeThemeDependencies(compiler: Compiler) {
    let collocation = []
    compiler.hooks.compilation.tap(
      PLUGIN_ID,
      (compilation: Compilation) => {
        // compilation.mainTemplate.hooks.renderManifest
        compilation.hooks.beforeChunkAssets.tap(
          PLUGIN_ID,
          () => {
            compilation.chunks.forEach((chunk) => {
              for (const group of chunk.groupsIterable) {
                const chunks = group.chunks
                chunks.forEach((chunk) => {
                  if (/^theme-(.*)/i.test(chunk.name)) {
                    // @TODO: 改成set去重
                    collocation = unionWith(
                      eqBy(prop('name')),
                      collocation,
                      [chunk]
                    )
                  }
                })
                const removed = collocation.slice(0)
                while (removed.length) {
                  const chunk = removed.shift()
                  if (chunks.indexOf(chunk) !== -1) {
                    chunks.splice(chunks.indexOf(chunk), 1)
                  }
                }
              }
            })
            if (collocation.length) {
              this.collocation = this.createThemeMap(
                compilation,
                collocation
              )
            }
          }
        )
      }
    )
  }
  private createThemeMap(
    compilation: Compilation,
    collocation: string | any[]
  ) {
    const result = {}
    const outputOptions = compilation.outputOptions
    const publicPath = (outputOptions.publicPath ||
      '') as string
    for (let i = 0; i < collocation.length; i++) {
      const chunk = collocation[i]
      try {
        const template = chunk.hasRuntime()
          ? compilation.mainTemplate
          : compilation.chunkTemplate
        const manifest = (
          template as any
        ).getRenderManifest({
          chunk,
          hash: compilation.hash,
          fullHash: compilation.fullHash,
          outputOptions,
          moduleTemplates: compilation.moduleTemplates,
          dependencyTemplates:
            compilation.dependencyTemplates,
        })
        for (const fileManifest of manifest) {
          const file = compilation.getPathWithInfo
            ? compilation.getPathWithInfo(
                fileManifest.filenameTemplate,
                fileManifest.pathOptions
              )
            : // webpack old version
              (compilation.getPath(
                fileManifest.filenameTemplate,
                fileManifest.pathOptions
              ) as any)
          if (
            typeof file === 'string' &&
            (file as string).endsWith('.css')
          ) {
            result[chunk.name] = url.resolve(
              publicPath,
              file
            )
          } else if (
            file.path &&
            file.path.endsWith('.css')
          ) {
            result[chunk.name] = url.resolve(
              publicPath,
              file.path
            )
          }
        }
      } catch (e) {
        console.log(e)
      }
    }
    return result
  }
  private removeThemeTag(tag: any) {
    const { attributes } = tag
    for (const i in attributes) {
      const value = attributes[i]
      if (/^theme-(.*)/i.test(value)) {
        return false
      }
    }
    return true
  }
  private injectToHTML(compiler: Compiler) {
    compiler.hooks.compilation.tap(
      PLUGIN_ID,
      (compilation) => {
        const [HtmlWebpackPlugin] =
          compiler.options.plugins.filter(
            (plugin) =>
              plugin.constructor.name ===
              'HtmlWebpackPlugin'
          )
        if (!HtmlWebpackPlugin.constructor['getHooks']) {
          return console.log(
            'HtmlWebpackPlugin version too low, please upgrade to 4+'
          )
        }
        HtmlWebpackPlugin.constructor['getHooks'](
          compilation
        ).alterAssetTagGroups.tapAsync(
          PLUGIN_ID,
          (
            htmlPluginData: {
              headTags: {
                tagName: string
                innerHTML: string
              }[]
              bodyTags: any[]
            },
            callback: (arg0: any) => void
          ) => {
            try {
              htmlPluginData.headTags =
                htmlPluginData.headTags.filter(
                  this.removeThemeTag
                )
              htmlPluginData.bodyTags =
                htmlPluginData.bodyTags.filter(
                  this.removeThemeTag
                )
              htmlPluginData.headTags.push({
                tagName: 'script',
                innerHTML: `window.__DFLUX_THEMES__=${JSON.stringify(
                  this.collocation
                )}`,
              })
              callback(null)
            } catch (error) {
              callback(error)
            }
          }
        )
      }
    )
  }
  private generateSplitChunks(compiler: Compiler) {
    const optimization = compiler.options.optimization
    const cacheGroups =
      optimization.splitChunks['cacheGroups']

    this.plantforms.forEach((name) => {
      if (cacheGroups[name]) {
        return
      }
      // 如果没有在开发环境配置 mini-css-extract-plugin
      // 分组规则并不会生效。
      cacheGroups[name] = {
        name: `theme-${name}`,
        chunks: 'all',
        enforce: true,
        test(m: {
          constructor: { name: string }
          _identifier: string
        }) {
          return (
            m.constructor.name === 'CssModule' &&
            new RegExp(
              `-${name}.stylus|theme=${name}`
            ).test(m._identifier)
          )
        },
      }
    })
  }
  private idempotentAddExtractCss(compiler: Compiler) {
    if (
      this.hasPlugin(
        compiler.options.plugins,
        'MiniCssExtractPlugin'
      )
    ) {
      return
    }
    const ExtraPlugin = safeRequire(
      'mini-css-extract-plugin'
    )
    compiler.options.plugins.push(
      new ExtraPlugin({
        filename: 'css/[name].css',
        chunkFilename: 'css/[name].css',
      })
    )

    /**
     * 添加loader
     * @TODOs 看下有没有必要增加/删减，理论上一个css就够了
     */
    this.addExtraLoaderTo(compiler, '.css')
    this.addExtraLoaderTo(compiler, '.stylus')
  }
  private addExtraLoaderTo(
    compiler: Compiler,
    type: string
  ) {
    const ExtraPluginLoader = {
      loader: require.resolve(
        'mini-css-extract-plugin/dist/loader',
        {
          paths: [
            process.env.NODE_ENV === 'test'
              ? path.resolve(
                  __dirname,
                  '../__tests__/webpack'
                )
              : process.cwd(),
          ],
        }
      ),
      options: {
        hmr: true,
        publicPath: '../',
      },
      ident: PLUGIN_ID + uid++,
    }
    const rules = this.findAndModifyLoader(
      compiler,
      type,
      (cssUse, cssRule) => {
        /**
         * {
         *  test: /\.css$/, || stylus...etc
         *  use: [...]
         * }
         * or
         * {
         *  test: /\.css$/, || stylus...etc
         *  oneOf: [...]
         * }
         *
         * vue-style-loader & extrat-css-loader 2选1
         */
        if (cssUse) {
          let index = -1
          for (let i = 0; i < cssUse.length; i++) {
            const u = cssUse[i] as any
            if (
              /^vue-style-loader|(\/|\\|@)vue-style-loader/.test(
                u.loader
              )
            ) {
              index = i
              break
            }
          }
          if (index >= 0) {
            cssUse.splice(index, 1)
          }
          cssUse.unshift(ExtraPluginLoader)
        } else {
          cssRule.oneOf.forEach((rule: any) => {
            rule['use'] = rule['use'].filter(
              (u) =>
                !/^vue-style-loader|(\/|\\|@)vue-style-loader/.test(
                  u.loader
                )
            )
            rule['use'].unshift(ExtraPluginLoader)
          })
        }
      }
    )
    if (rules) {
      compiler.options.module.rules = [...rules]
    }
  }
  private hasPlugin(plugins, pluginName) {
    return plugins.some(
      (plugin) => plugin.constructor.name === pluginName
    )
  }
}
