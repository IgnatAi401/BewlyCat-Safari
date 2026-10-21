#!/usr/bin/env node
// 汇总 macOS `sample` 输出中主线程的时间去向（样本数为包含子调用的总数，同类嵌套只计一次）。
// 用法：node scripts/safari/summarize-sample.mjs <xxx.sample.txt>...

import { readFile } from 'node:fs/promises'
import process from 'node:process'

const CATEGORIES = [
  ['JS 执行', /vmEntryToJavaScript|JSC::Interpreter::execute/],
  ['定时器回调', /WebCore::DOMTimer::fired/],
  ['rAF 回调', /serviceRequestAnimationFrameCallbacks/],
  ['MutationObserver 回调', /WebCore::MutationObserver::deliver/],
  ['IntersectionObserver', /IntersectionObserver/],
  ['ResizeObserver', /ResizeObserver/],
  ['事件派发', /WebCore::EventTarget::fireEventListeners/],
  ['样式计算', /WebCore::Style::TreeResolver::resolve|WebCore::Document::resolveStyle/],
  ['布局', /WebCore::LocalFrameView::layout|WebCore::LocalFrameViewLayoutContext::layout/],
  ['渲染更新（整体）', /WebCore::Page::updateRendering/],
  ['合成层更新', /WebCore::RenderLayerCompositor::updateCompositingLayers|flushCompositingState/],
  ['绘制', /WebCore::RenderLayer::paint|WebCore::GraphicsLayerCA::platformCALayerPaintContents|WebCore::LocalFrameView::paintContents/],
  ['图片解码', /ImageDecoder|ImageSource::|decodeImage/],
  ['选择器匹配 (querySelector)', /WebCore::SelectorQuery|querySelector/],
  ['垃圾回收', /JSC::Heap::collect|JSC::Heap::runCurrentPhase|JSC::Heap::sweep|IncrementalSweeper/],
  ['网络回调', /WebCore::ResourceLoader::didReceive|CachedResource::finish|XMLHttpRequest::didFinishLoading|FetchResponse/],
  ['扩展消息', /WebExtension/],
]

function summarize(text) {
  const lines = text.split('\n')
  // 主线程标为 com.apple.main-thread，同时在多个队列上运行时标为 Main Thread。
  const start = lines.findIndex(line => line.includes('Thread_') && (line.includes('com.apple.main-thread') || line.includes('Main Thread')))
  if (start < 0)
    return undefined
  const rootDepth = lines[start].search(/\d/)
  const total = Number(lines[start].trim().split(/\s+/)[0])
  const totals = new Map(CATEGORIES.map(([name]) => [name, 0]))
  // JS 调用的 DOM 接口（WebKit 绑定函数），可看出哪些 DOM 调用最耗时（如强制同步布局）。
  const bindings = new Map()
  // 每类记录当前祖先链上是否已计入，避免递归重复计数。
  const stack = []
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(/^([\s+!:|]*)(\d+) +(\S.*)$/)
    if (!match)
      break
    const depth = match[1].length
    if (depth <= rootDepth)
      break
    const count = Number(match[2])
    const symbol = match[3]
    while (stack.length && stack.at(-1).depth >= depth)
      stack.pop()
    const matched = []
    const inherited = stack.at(-1)?.categories ?? []
    for (const [name, pattern] of CATEGORIES) {
      if (pattern.test(symbol) && !inherited.includes(name)) {
        totals.set(name, totals.get(name) + count)
        matched.push(name)
      }
    }
    // 形如 WebCore::jsElementPrototypeFunction_getBoundingClientRect、WebCore::jsDocument_cookie
    const binding = symbol.match(/WebCore::js([A-Z]\w*_\w+)/)?.[1]
    const bindingName = binding?.replace(/(?:Prototype|Instance)Function_|_/, '.').replace(/(?:Getter|Setter|Body)$/, '')
    if (bindingName && !inherited.includes(`binding:${bindingName}`)) {
      bindings.set(bindingName, (bindings.get(bindingName) ?? 0) + count)
      matched.push(`binding:${bindingName}`)
    }
    stack.push({ depth, categories: [...inherited, ...matched] })
  }
  return { total, totals, bindings }
}

for (const file of process.argv.slice(2)) {
  const result = summarize(await readFile(file, 'utf8'))
  console.log(`\n## ${file}`)
  if (!result) {
    console.log('未找到主线程调用栈')
    continue
  }
  console.log(`主线程样本 ${result.total}`)
  for (const [name, count] of [...result.totals].sort((a, b) => b[1] - a[1])) {
    if (count > 0)
      console.log(`  ${name.padEnd(24)} ${String(count).padStart(6)}  ${(count / result.total * 100).toFixed(1)}%`)
  }
  const topBindings = [...result.bindings].sort((a, b) => b[1] - a[1]).slice(0, 15)
  if (topBindings.length)
    console.log('  耗时最多的 DOM 接口调用：')
  for (const [name, count] of topBindings)
    console.log(`    ${name.padEnd(40)} ${String(count).padStart(6)}  ${(count / result.total * 100).toFixed(1)}%`)
}
