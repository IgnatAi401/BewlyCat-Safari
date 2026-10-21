// 页面脚本（MAIN world）中运行，不能使用扩展 API。
//
// 回复树重算（updateCommentReplyTree）每次都要读取容器宽度和头像位置，在缩进样式刚被改过后
// 会强制同步布局，单次约 2～3 毫秒；登录后评论区滚动加载时它是扩展最主要的额外开销。Safari 中减少两类多余的重算：
// - 评论楼层、回复列表及其中每条回复的组件更新都会触发重算，同一楼层一帧内常有 2～4 次。
//   同一帧内只立即执行第一次，其余合并为下一帧执行一次。
// - 重算写入缩进后楼层尺寸随之改变，ResizeObserver 在同一帧随即回调，原逻辑会在下一帧再重算一遍。
//   重算时读取的布局已包含这次写入，结果不会变化；本帧已重算过的楼层不再为此重算。
// 滚动 12 秒的重算次数从约 180 次降到约 120 次，最终缩进与引导线与关闭再打开回复树后完全重算的结果一致。

const lastUpdateFrames = new WeakMap<object, number>()
const trailingUpdates = new WeakSet<object>()

function getCurrentFrame(): number {
  // 同一帧的所有 rAF 回调、ResizeObserver 回调及其间的任务中，document.timeline.currentTime 相同。
  const time = document.timeline?.currentTime
  return typeof time === 'number' ? time : performance.now()
}

// 每次重算开始时调用，记录该楼层本帧已重算。
export function noteSafariCommentReplyTreeUpdate(component: object) {
  lastUpdateFrames.set(component, getCurrentFrame())
}

export function isSafariCommentReplyTreeUpdatedThisFrame(component: object): boolean {
  return lastUpdateFrames.get(component) === getCurrentFrame()
}

// 返回 true 表示本次重算已合并到下一帧，调用方应直接返回。
export function coalesceSafariCommentReplyTreeUpdate(component: object, update: () => void): boolean {
  if (!isSafariCommentReplyTreeUpdatedThisFrame(component))
    return false

  if (!trailingUpdates.has(component)) {
    trailingUpdates.add(component)
    requestAnimationFrame(() => {
      trailingUpdates.delete(component)
      if ((component as Node).isConnected !== false)
        update()
    })
  }
  return true
}
