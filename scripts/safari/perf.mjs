#!/usr/bin/env node
// Safari 性能测试：用 safaridriver 打开自动化窗口跑各场景，采集页面帧间隔（卡顿）、主线程长任务、
// DOM 规模、网络请求，以及标签页进程的 CPU 时间与内存占用。
//
// 首次使用需在 Safari 设置 → 开发者中勾选「允许远程自动化」。自动化 Safari 是独立的临时实例（没有 B 站登录态），
// 新装的扩展必须手动授权，且授权只在该实例退出前有效；改代码重新构建后要重新安装和授权：
//   1. pnpm build-safari
//   2. node scripts/safari/perf.mjs --install            # 重启自动化 Safari 并安装 extension-safari/
//      在弹出的自动化窗口中点一下页面 → 「停止会话」→ 点工具栏的 BewlyCat 图标 →「始终允许」，不要退出 Safari
//   3. node scripts/safari/perf.mjs --variants ext [--scenarios home,video] [--runs 2] [--sample]
// 不装扩展的对照组需要没有扩展的新实例（会丢掉上面的授权）：
//   node scripts/safari/perf.mjs --variants base --restart-safari
//
// 登录态：自动化 Safari 的 Cookie 只在单个会话内有效。加 --login 时先打开扫码登录页，用手机 B 站 App 扫码
// （无需点击窗口，会话不会中断），登录后所有场景在同一会话中运行：
//   node scripts/safari/perf.mjs --variants ext --login --scenarios video,moments,history
// 先单独启动 `safaridriver -p 4444`，再加 --keep-session 可保留登录会话（打印会话 ID），之后用 --session <ID> 复用，免去重复扫码。
//
// 结果写入输出目录的 results.json 和 summary.md；--sample 额外保存调用栈采样，用 summarize-sample.mjs 汇总。

import { execFile, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const { values: args } = parseArgs({
  options: {
    variants: { type: 'string', default: 'ext' },
    scenarios: { type: 'string', default: 'home,video,search,space,popular' },
    runs: { type: 'string', default: '1' },
    port: { type: 'string', default: '4444' },
    ext: { type: 'string', default: path.join(ROOT, 'extension-safari') },
    // 用 macOS 的 sample 工具采样空闲与滚动阶段的标签页进程调用栈，保存到输出目录。
    sample: { type: 'boolean', default: false },
    'install': { type: 'boolean', default: false },
    'restart-safari': { type: 'boolean', default: false },
    'login': { type: 'boolean', default: false },
    'session': { type: 'string' },
    'keep-session': { type: 'boolean', default: false },
    out: { type: 'string', default: path.join(os.tmpdir(), 'bewlycat-safari-perf', new Date().toISOString().replace(/[:.]/g, '-')) },
  },
})

const DRIVER = `http://127.0.0.1:${args.port}`
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// ---------- WebDriver ----------

async function wd(method, url, body) {
  const response = await fetch(`${DRIVER}${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await response.json()
  if (json.value && json.value.error)
    throw new Error(`${method} ${url}: ${json.value.error} ${json.value.message}`)
  return json.value
}

async function ensureDriver() {
  try {
    await wd('GET', '/status')
    return undefined
  }
  catch {}
  const driver = spawn('safaridriver', ['-p', args.port], { stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    await sleep(200)
    try {
      await wd('GET', '/status')
      return driver
    }
    catch {}
  }
  throw new Error('safaridriver 未能启动')
}

let activeSessionId

const AUTOMATION_SAFARI_PATTERN = 'Safari.app/Contents/MacOS/Safari .*--automation'

// 退出 safaridriver 启动的自动化 Safari（不影响日常使用的 Safari）。自动化实例会一直保留之前会话安装的扩展，
// 且新会话无法卸载它们，只有退出实例才能清除。
async function quitAutomationSafari() {
  await execFileAsync('pkill', ['-f', AUTOMATION_SAFARI_PATTERN]).catch(() => {})
  for (let i = 0; i < 50; i++) {
    try {
      await execFileAsync('pgrep', ['-f', AUTOMATION_SAFARI_PATTERN])
    }
    catch {
      return
    }
    await sleep(200)
  }
}

async function createSession() {
  // 刚退出的 Safari 可能尚未被 safaridriver 释放，失败时稍后重试。
  for (let attempt = 1; ; attempt++) {
    try {
      // eager：导航在 DOMContentLoaded 时返回，之后才能从页面内及时测到卡片出现的时刻（默认会等到 load 事件）。
      const session = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari', pageLoadStrategy: 'eager' } } })
      activeSessionId = session.sessionId
      return session
    }
    catch (error) {
      if (attempt >= 3)
        throw error
      await sleep(3000)
    }
  }
}

// 中断时关闭会话，否则 Safari 会一直与旧会话配对，之后无法新建会话。
process.once('SIGINT', async () => {
  if (activeSessionId)
    await wd('DELETE', `/session/${activeSessionId}`).catch(() => {})
  process.exit(130)
})

// 在页面主线程执行；异步脚本以最后一个参数作为回调。
function execute(sessionId, fn, ...fnArgs) {
  return wd('POST', `/session/${sessionId}/execute/sync`, {
    script: `return (${fn}).apply(null, arguments)`,
    args: fnArgs,
  })
}

function executeAsync(sessionId, fn, ...fnArgs) {
  return wd('POST', `/session/${sessionId}/execute/async`, {
    script: `const done = arguments[arguments.length - 1]; Promise.resolve((${fn}).apply(null, Array.prototype.slice.call(arguments, 0, -1))).then(done, e => done({ error: String(e) }))`,
    args: fnArgs,
  })
}

// ---------- 进程指标 ----------

function parseCpuTime(text) {
  // ps 的 time 列：[天-][时:]分:秒.百分秒
  const [dayPart, rest] = text.includes('-') ? text.split('-') : ['0', text]
  const parts = rest.split(':').map(Number)
  let seconds = 0
  for (const part of parts)
    seconds = seconds * 60 + part
  return Number(dayPart) * 86400 + seconds
}

async function webkitProcesses() {
  const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,time=,comm='])
  const result = new Map()
  for (const line of stdout.split('\n')) {
    const [pid, time, command] = line.trim().split(/\s+/, 3)
    const kind = command?.match(/com\.apple\.WebKit\.([A-Za-z]+)/)?.[1]
    if (kind)
      result.set(Number(pid), { cpu: parseCpuTime(time), kind })
  }
  return result
}

async function footprintMB(pid) {
  try {
    const { stdout } = await execFileAsync('footprint', ['-p', String(pid), '-f', 'bytes', '--noCategories'])
    const match = stdout.match(/Footprint:\s*(\d+)\s*B/)
    return match ? Math.round(Number(match[1]) / 1048576) : null
  }
  catch {
    return null
  }
}

// 让页面忙等一段时间，CPU 时间随之增长的 WebContent 进程即为当前标签页进程。
async function identifyTabPid(sessionId) {
  const before = await webkitProcesses()
  await execute(sessionId, () => {
    const end = performance.now() + 1500
    while (performance.now() < end) {
      // 忙等
    }
  })
  const after = await webkitProcesses()
  let best
  for (const [pid, info] of after) {
    if (info.kind !== 'WebContent')
      continue
    const delta = info.cpu - (before.get(pid)?.cpu ?? 0)
    if (!best || delta > best.delta)
      best = { pid, delta }
  }
  return best && best.delta > 1 ? best.pid : undefined
}

async function sampleProcess(pid, seconds, file) {
  try {
    // 每 5ms 采样一次：默认 1ms 会频繁暂停进程，明显拉低帧率。
    await execFileAsync('sample', [String(pid), String(seconds), '5', '-mayDie', '-file', file])
  }
  catch {}
}

// 统计一段时间内各类 WebKit 进程消耗的 CPU 秒数；指定 sampleFile 时同时采样调用栈。
async function measureCpu(tabPid, action, sampleFile) {
  const before = await webkitProcesses()
  const start = Date.now()
  const sampling = sampleFile && tabPid ? sampleProcess(tabPid, 6, sampleFile) : undefined
  const actionResult = await action()
  await sampling
  const wallSec = (Date.now() - start) / 1000
  const after = await webkitProcesses()
  const cpu = { tab: 0, otherWebContent: 0, gpu: 0, networking: 0 }
  for (const [pid, info] of after) {
    const delta = Math.max(0, info.cpu - (before.get(pid)?.cpu ?? info.cpu))
    if (pid === tabPid)
      cpu.tab += delta
    else if (info.kind === 'WebContent')
      cpu.otherWebContent += delta
    else if (info.kind === 'GPU')
      cpu.gpu += delta
    else if (info.kind === 'Networking')
      cpu.networking += delta
  }
  for (const key of Object.keys(cpu))
    cpu[key] = round(cpu[key], 2)
  return { wallSec: round(wallSec, 1), cpuSec: cpu, tabCpuPercent: round(cpu.tab / wallSec * 100, 1), actionResult }
}

// ---------- 页面内脚本 ----------

function installMonitor() {
  const state = window.__bewlyPerf || (window.__bewlyPerf = { installed: false })
  state.frames = []
  state.lags = []
  state.events = []
  state.requests = 0
  state.recordFrames = false
  if (state.installed)
    return
  state.installed = true
  // 计时器延迟探针：不触发渲染，计时器被推迟超过 50ms 视为主线程被长任务占用。
  const interval = 50
  let expected = performance.now() + interval
  setInterval(() => {
    const now = performance.now()
    if (now - expected > 50)
      state.lags.push(now - expected)
    expected = now + interval
  }, interval)
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        state.events.push({ name: entry.name, duration: entry.duration })
    }).observe({ type: 'event', durationThreshold: 16 })
  }
  catch {}
  new PerformanceObserver((list) => {
    state.requests += list.getEntries().length
  }).observe({ type: 'resource' })
}

// 只在需要测帧率的阶段运行 rAF，避免空闲阶段的 rAF 循环让页面每帧都更新渲染、抬高 CPU。
function startFrames() {
  const state = window.__bewlyPerf
  state.frames = []
  state.recordFrames = true
  let last = performance.now()
  const tick = (time) => {
    if (!state.recordFrames)
      return
    state.frames.push(time - last)
    last = time
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function collectFrames() {
  const state = window.__bewlyPerf
  state.recordFrames = false
  const frames = state.frames.slice(1)
  const { lags, events, requests } = state
  state.frames = []
  state.lags = []
  state.events = []
  state.requests = 0
  const sorted = [...frames].sort((a, b) => a - b)
  const total = frames.reduce((sum, value) => sum + value, 0)
  const pick = q => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0
  return {
    frames: frames.length,
    fps: total ? frames.length / (total / 1000) : null,
    p95FrameMs: pick(0.95),
    maxFrameMs: sorted.at(-1) || 0,
    jankFrames: frames.filter(value => value > 50).length,
    frameBlockingMs: frames.reduce((sum, value) => sum + Math.max(0, value - 50), 0),
    longTasks: lags.length,
    longTaskMs: lags.reduce((sum, value) => sum + value, 0),
    maxLongTaskMs: lags.reduce((max, value) => Math.max(max, value), 0),
    requests,
    slowEvents: events.length,
    maxEventMs: events.reduce((max, entry) => Math.max(max, entry.duration), 0),
  }
}

function collectPageStats() {
  let shadowRoots = 0
  let total = 0
  const walk = (root) => {
    for (const element of root.querySelectorAll('*')) {
      total++
      if (element.shadowRoot) {
        shadowRoots++
        walk(element.shadowRoot)
      }
    }
  }
  walk(document)
  const bewly = document.querySelector('#bewly')?.shadowRoot
  const resources = performance.getEntriesByType('resource')
  const lcp = performance.getEntriesByType('largest-contentful-paint').at(-1)
  const nav = performance.getEntriesByType('navigation')[0]
  const video = document.querySelector('video')
  const commentsRoot = document.querySelector('bili-comments')?.shadowRoot
  return {
    url: location.href,
    bewlyMounted: !!bewly,
    videoHeight: video ? video.videoHeight : null,
    videoPlaying: video ? !video.paused : null,
    comments: commentsRoot ? commentsRoot.querySelectorAll('bili-comment-thread-renderer').length : null,
    domNodes: document.getElementsByTagName('*').length,
    allNodes: total,
    shadowRoots,
    bewlyNodes: bewly ? bewly.querySelectorAll('*').length : 0,
    cards: bewly
      ? bewly.querySelectorAll('.video-card-container[data-layout-edit-target]').length
      : document.querySelectorAll('.bili-video-card, .video-list-item, .small-item').length,
    images: document.images.length + (bewly ? bewly.querySelectorAll('img').length : 0),
    iframes: document.querySelectorAll('iframe').length,
    resources: resources.length,
    domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : null,
    loadMs: nav ? nav.loadEventEnd : null,
    lcpMs: lcp ? lcp.startTime : null,
  }
}

// 等待请求稳定（quietMs 内没有新请求）或超时，返回最后一个请求的时刻（自导航开始）。
// 资源计时缓冲区满后 getEntriesByType 不再增长，改用 PerformanceObserver 计数，它不受缓冲区大小限制。
function waitForSettled(quietMs, timeoutMs) {
  performance.setResourceTimingBufferSize(100_000)
  return new Promise((resolve) => {
    const start = performance.now()
    let lastChange = performance.now()
    const observer = new PerformanceObserver(() => {
      lastChange = performance.now()
    })
    observer.observe({ type: 'resource' })
    const timer = setInterval(() => {
      const now = performance.now()
      if (now - lastChange >= quietMs || now - start >= timeoutMs) {
        clearInterval(timer)
        observer.disconnect()
        resolve(Math.round(lastChange))
      }
    }, 100)
  })
}

// 等待指定数量的卡片出现，返回出现时刻（自导航开始），超时返回 null。
function waitForCards(minCards, timeoutMs) {
  return new Promise((resolve) => {
    const start = performance.now()
    const check = () => {
      const bewly = document.querySelector('#bewly')?.shadowRoot
      const count = bewly
        ? bewly.querySelectorAll('.video-card-container[data-layout-edit-target]').length
        : document.querySelectorAll('.bili-video-card').length
      if (count >= minCards)
        return resolve(Math.round(performance.now()))
      if (performance.now() - start > timeoutMs)
        return resolve(null)
      setTimeout(check, 50)
    }
    check()
  })
}

// 以固定速度向下滚动，模拟连续浏览；返回滚动距离。
// 滚动窗口中心处元素最近的可滚动祖先（与滚轮作用的对象一致），如首页的 .bewly-scroll-viewport。
// （safaridriver 的滚轮动作不可靠，多次滚动不会累加。）
function scrollFor(durationMs, pxPerFrame) {
  const x = innerWidth / 2
  const y = innerHeight / 2
  let element = document.elementFromPoint(x, y)
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y)
    if (!inner || inner === element)
      break
    element = inner
  }
  let scroller = document.scrollingElement
  for (let node = element; node && node !== document.documentElement && node !== document.body;) {
    const { overflowY } = getComputedStyle(node)
    if (/auto|scroll|overlay/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
      scroller = node
      break
    }
    node = node.parentElement || node.getRootNode().host
  }
  window.__bewlyPerfScroller = scroller
  return new Promise((resolve) => {
    const startTop = scroller.scrollTop
    const end = performance.now() + durationMs
    const step = () => {
      scroller.scrollBy(0, pxPerFrame)
      if (performance.now() < end)
        requestAnimationFrame(step)
      else
        resolve(Math.round(scroller.scrollTop - startTop))
    }
    requestAnimationFrame(step)
  })
}

function scrollToTop() {
  (window.__bewlyPerfScroller || document.scrollingElement).scrollTo(0, 0)
}

// ---------- 场景 ----------

const VIDEO_URL = 'https://www.bilibili.com/video/BV1GJ411x7h7/'

// 以下场景需要登录才有内容（未登录时动态页为登录引导、历史记录为空）。
const LOGIN_SCENARIOS = {
  moments: { url: 'https://t.bilibili.com/', idleMs: 8_000, scrollMs: 15_000 },
  history: { url: 'https://www.bilibili.com/history', idleMs: 8_000, scrollMs: 10_000 },
}

const SCENARIOS = {
  home: { url: 'https://www.bilibili.com/', cards: true, idleMs: 10_000, scrollMs: 15_000 },
  video: { url: VIDEO_URL, idleMs: 10_000, scrollMs: 10_000 },
  search: { url: 'https://search.bilibili.com/all?keyword=%E5%8E%9F%E7%A5%9E', idleMs: 8_000, scrollMs: 10_000 },
  space: { url: 'https://space.bilibili.com/2', idleMs: 8_000, scrollMs: 8_000 },
  popular: { url: 'https://www.bilibili.com/v/popular/all', idleMs: 8_000, scrollMs: 10_000 },
  ...LOGIN_SCENARIOS,
}

let sharedSessionId

async function isLoggedIn(sessionId) {
  const result = await executeAsync(sessionId, () => fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' })
    .then(response => response.json())
    .then(data => !!data?.data?.isLogin)
    .catch(() => false))
  return result === true
}

// 打开扫码登录页并等待登录完成（最多 5 分钟），返回已登录的会话。
async function createLoginSession() {
  const { sessionId } = await createSession()
  await wd('POST', `/session/${sessionId}/timeouts`, { script: 120_000, pageLoad: 60_000 })
  await wd('POST', `/session/${sessionId}/window/rect`, { x: 0, y: 0, width: 1440, height: 900 })
  await wd('POST', `/session/${sessionId}/url`, { url: 'https://passport.bilibili.com/login' })
  console.log('请用手机 B 站 App 扫描自动化窗口中的二维码登录（不要点击窗口，否则会话会停止）……')
  for (let i = 0; i < 150; i++) {
    await sleep(2000)
    if (await isLoggedIn(sessionId)) {
      console.log('已登录')
      return sessionId
    }
  }
  throw new Error('5 分钟内未完成扫码登录')
}

async function runScenario(variant, name, run) {
  const scenario = SCENARIOS[name]
  const sessionId = sharedSessionId ?? (await createSession()).sessionId
  try {
    await wd('POST', `/session/${sessionId}/timeouts`, { script: 120_000, pageLoad: 60_000 })
    await wd('POST', `/session/${sessionId}/window/rect`, { x: 0, y: 0, width: 1440, height: 900 })

    // 先打开空白页确定标签页进程，导航阶段的 CPU 也计入同一进程（跨站导航可能换进程，下面会复核）。
    await wd('POST', `/session/${sessionId}/url`, { url: 'https://www.bilibili.com/robots.txt' })
    let tabPid = await identifyTabPid(sessionId)

    const sampleFile = phase => args.sample ? path.join(args.out, `${name}-${variant}-r${run}-${phase}.sample.txt`) : undefined
    const load = await measureCpu(tabPid, async () => {
      await wd('POST', `/session/${sessionId}/url`, { url: scenario.url })
      const cardsMs = scenario.cards ? await executeAsync(sessionId, waitForCards, 10, 20_000) : null
      const settledMs = await executeAsync(sessionId, waitForSettled, 2000, 20_000)
      return { cardsMs, settledMs }
    }, sampleFile('load'))
    const pidAfterLoad = await identifyTabPid(sessionId)
    if (pidAfterLoad !== tabPid) {
      load.cpuSec.tab = null
      load.tabCpuPercent = null
      tabPid = pidAfterLoad
    }
    const mounted = await execute(sessionId, () => !!document.querySelector('#bewly'))
    if (variant === 'ext' && !mounted)
      throw new Error('页面上没有 BewlyCat：先运行 --install 并在自动化窗口中授权扩展')
    if (variant === 'base' && mounted)
      throw new Error('自动化 Safari 中仍有扩展：对照组请加 --restart-safari')
    if (sharedSessionId && !await isLoggedIn(sessionId))
      throw new Error('登录已失效')

    await execute(sessionId, installMonitor)
    const idle = await measureCpu(tabPid, () => sleep(scenario.idleMs), sampleFile('idle'))
    idle.frames = await execute(sessionId, collectFrames)

    await execute(sessionId, startFrames)
    const scroll = await measureCpu(tabPid, () => executeAsync(sessionId, scrollFor, scenario.scrollMs, 25), sampleFile('scroll'))
    scroll.frames = await execute(sessionId, collectFrames)

    const settleAfterScroll = await measureCpu(tabPid, () => sleep(5000))
    settleAfterScroll.frames = await execute(sessionId, collectFrames)

    const page = await execute(sessionId, collectPageStats)
    await execute(sessionId, scrollToTop)
    const memoryMB = await footprintMB(tabPid)
    return { variant, scenario: name, tabPid, load, idle, scroll, settleAfterScroll, page, memoryMB }
  }
  finally {
    if (!sharedSessionId) {
      await wd('DELETE', `/session/${sessionId}`).catch(() => {})
      activeSessionId = undefined
    }
  }
}

// ---------- 汇总 ----------

function round(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value))
    return value
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function median(values) {
  const list = values.filter(value => typeof value === 'number').sort((a, b) => a - b)
  if (!list.length)
    return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

const COLUMNS = [
  ['卡片可见 ms', r => r.load.actionResult.cardsMs],
  ['请求稳定 ms', r => r.load.actionResult.settledMs],
  ['LCP ms', r => round(r.page.lcpMs)],
  ['加载 CPU s', r => r.load.cpuSec.tab],
  ['空闲 CPU %', r => r.idle.tabCpuPercent],
  ['空闲长任务', r => r.idle.frames.longTasks],
  ['空闲长任务 ms', r => round(r.idle.frames.longTaskMs)],
  ['滚动 FPS', r => round(r.scroll.frames.fps, 1)],
  ['滚动 P95 帧 ms', r => round(r.scroll.frames.p95FrameMs, 1)],
  ['滚动卡顿帧', r => r.scroll.frames.jankFrames],
  ['滚动阻塞 ms', r => round(r.scroll.frames.frameBlockingMs)],
  ['滚动后长任务 ms', r => round(r.settleAfterScroll.frames.longTaskMs)],
  ['滚动 CPU %', r => r.scroll.tabCpuPercent],
  ['GPU CPU s', r => round(r.load.cpuSec.gpu + r.idle.cpuSec.gpu + r.scroll.cpuSec.gpu, 1)],
  ['DOM 节点', r => r.page.allNodes],
  ['扩展节点', r => r.page.bewlyNodes],
  ['滚动请求数', r => r.scroll.frames.requests],
  ['内存 MB', r => r.memoryMB],
  ['视频高度', r => r.page.videoHeight],
  ['评论数', r => r.page.comments],
]

function summarize(results) {
  const lines = [`# Safari 性能测试结果`, '', `时间：${new Date().toLocaleString()}，轮数：${args.runs}（多轮取中位数）`, '']
  lines.push(`| 场景 | 变体 | ${COLUMNS.map(([title]) => title).join(' | ')} |`)
  lines.push(`| --- | --- | ${COLUMNS.map(() => '---').join(' | ')} |`)
  for (const scenario of new Set(results.map(r => r.scenario))) {
    for (const variant of new Set(results.map(r => r.variant))) {
      const runs = results.filter(r => r.scenario === scenario && r.variant === variant && !r.error)
      if (!runs.length)
        continue
      const cells = COLUMNS.map(([, get]) => {
        const value = median(runs.map((run) => {
          try {
            return get(run)
          }
          catch {
            return null
          }
        }))
        return value === null ? '—' : String(round(value, 1))
      })
      lines.push(`| ${scenario} | ${variant} | ${cells.join(' | ')} |`)
    }
  }
  const failed = results.filter(r => r.error)
  if (failed.length) {
    lines.push('', '失败：')
    for (const r of failed)
      lines.push(`- ${r.scenario}/${r.variant}: ${r.error}`)
  }
  lines.push('', '说明：卡顿帧指帧间隔超过 50ms，阻塞 ms 为超出 50ms 部分之和；长任务指 50ms 计时器被推迟超过 50ms（不跑 rAF，反映空闲时的主线程占用）；CPU % 为标签页进程占单核的百分比。')
  return lines.join('\n')
}

async function installExtension() {
  await quitAutomationSafari()
  const session = await createSession()
  await wd('POST', `/session/${session.sessionId}/window/rect`, { x: 0, y: 0, width: 1440, height: 900 })
  await wd('POST', `/session/${session.sessionId}/webextension`, { type: 'path', path: args.ext })
  await wd('POST', `/session/${session.sessionId}/url`, { url: 'https://www.bilibili.com/' })
  // 不关闭会话：用户在窗口里点击时 Safari 会提示停止会话，停止后扩展保留在该实例中。
  activeSessionId = undefined
  console.log([
    `已安装 ${args.ext}`,
    '请在自动化窗口中：点一下页面 →「停止会话」→ 点工具栏带 ⚠️ 的 BewlyCat 图标 →「始终允许」。',
    '不要退出 Safari；授权后运行 node scripts/safari/perf.mjs --variants ext',
  ].join('\n'))
}

async function main() {
  const variants = args.variants.split(',').filter(Boolean)
  const scenarios = args.scenarios.split(',').filter(Boolean)
  for (const name of scenarios) {
    if (!SCENARIOS[name])
      throw new Error(`未知场景：${name}（可选 ${Object.keys(SCENARIOS).join(', ')}）`)
  }
  const driver = await ensureDriver()
  if (args.install) {
    await installExtension()
    driver?.unref()
    return
  }
  if (args['restart-safari'])
    await quitAutomationSafari()
  await mkdir(args.out, { recursive: true })
  if (args.session) {
    sharedSessionId = activeSessionId = args.session
    if (!await isLoggedIn(sharedSessionId))
      throw new Error('该会话未登录或已失效')
  }
  else if (args.login) {
    sharedSessionId = await createLoginSession()
  }
  const results = []
  try {
    for (let run = 1; run <= Number(args.runs); run++) {
      for (const name of scenarios) {
        // 交替顺序，减少网络缓存与系统负载对某一变体的系统性偏差。
        const order = run % 2 ? variants : [...variants].reverse()
        for (const variant of order) {
          process.stdout.write(`[${run}] ${name} / ${variant} … `)
          try {
            const result = await runScenario(variant, name, run)
            results.push({ run, ...result })
            console.log(`空闲 CPU ${result.idle.tabCpuPercent}%，滚动卡顿帧 ${result.scroll.frames.jankFrames}，内存 ${result.memoryMB}MB`)
          }
          catch (error) {
            results.push({ run, variant, scenario: name, error: String(error) })
            console.log(`失败：${error}`)
          }
          await writeFile(path.join(args.out, 'results.json'), JSON.stringify(results, null, 2))
        }
      }
    }
  }
  finally {
    if (sharedSessionId && (args['keep-session'] || args.session))
      console.log(`保留登录会话：--session ${sharedSessionId}`)
    else if (activeSessionId)
      await wd('DELETE', `/session/${activeSessionId}`).catch(() => {})
    driver?.kill()
  }
  const summary = summarize(results)
  await writeFile(path.join(args.out, 'summary.md'), summary)
  console.log(`\n${summary}\n\n结果目录：${args.out}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
