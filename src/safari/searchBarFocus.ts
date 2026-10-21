// Safari 点击链接和按钮时不会让它们获得焦点：按下鼠标时搜索框先失焦，
// focusout 的 relatedTarget 为空，搜索栏随即收起下拉框（还带位移动画），
// 松开鼠标时已点不到搜索记录、热搜、联想词或清空按钮，点击不生效。
// 在这些区域按下鼠标时阻止默认行为，让输入框保持焦点，点击照常触发。
const KEEP_FOCUS_SELECTOR = '#search-dropdown, #search-suggestion, .search-bar button'

export function keepSafariSearchInputFocus(event: MouseEvent) {
  if (!__SAFARI__ || event.button !== 0)
    return

  const target = event.target
  if (target instanceof Element && target.closest(KEEP_FOCUS_SELECTOR))
    event.preventDefault()
}
