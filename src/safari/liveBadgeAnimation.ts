// 动态页「正在直播」头像角标是 0.5 秒 30 帧的逐帧精灵动画，实际每帧都要重绘；
// Safari 中仅这一处就让动态页空闲时标签页 CPU 多占约 14 个百分点。
// 停用动画后角标停在第一帧，仍能看出正在直播。
const LIVE_BADGE_STYLE_ID = 'bewly-safari-static-live-badge'
const LIVE_BADGE_CSS = '.bili-dyn-live-users__item__living::before{animation:none!important}'

export function stopSafariLiveBadgeAnimation() {
  if (document.getElementById(LIVE_BADGE_STYLE_ID))
    return

  const style = document.createElement('style')
  style.id = LIVE_BADGE_STYLE_ID
  style.textContent = LIVE_BADGE_CSS
  document.documentElement.appendChild(style)
}
