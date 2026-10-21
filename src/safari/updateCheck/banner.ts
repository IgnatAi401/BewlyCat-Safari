import browser from 'webextension-polyfill'

import { isInIframe } from '~/utils/main'
import { getRefreshPromptLocale } from '~/utils/refreshPrompt'

import type { SafariUpdateCopy, SafariUpdateState } from './shared'
import { formatCopy, getSafariUpdateCopy, UPDATE_GET_STATE_MESSAGE, UPDATE_SNOOZE_MS, updatePrefs } from './shared'

const BANNER_ID = 'bewlycat-safari-update'

const THEME_PROPERTIES = [
  '--bew-theme-color',
  '--bew-theme-color-80',
  '--bew-text-1',
  '--bew-text-2',
  '--bew-border-color',
  '--bew-elevated-solid',
  '--bew-fill-2',
  '--bew-panel-radius',
  '--bew-interactive-radius',
  '--bew-shadow-3',
]

const BANNER_CSS = `
  .banner {
    box-sizing: border-box;
    width: min(360px, calc(100vw - 32px));
    padding: 12px;
    color: var(--bew-text-1, #18191c);
    background: var(--bew-elevated-solid, #fff);
    border: 1px solid var(--bew-border-color, rgb(0 0 0 / 10%));
    border-radius: var(--bew-panel-radius, 12px);
    box-shadow: var(--bew-shadow-3, 0 8px 30px rgb(0 0 0 / 18%));
    font-size: 13px;
    line-height: 18px;
  }
  :host([data-theme="dark"]) .banner {
    color: var(--bew-text-1, #f1f2f3);
    background: var(--bew-elevated-solid, #2b2d31);
    border-color: var(--bew-border-color, rgb(255 255 255 / 12%));
  }
  .title {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 600;
    line-height: 22px;
  }
  p {
    margin: 0 0 4px;
    color: var(--bew-text-2, #61666d);
    overflow-wrap: anywhere;
  }
  :host([data-theme="dark"]) p {
    color: var(--bew-text-2, #c9ccd0);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
  button {
    min-height: 32px;
    padding: 0 12px;
    color: inherit;
    font: inherit;
    font-weight: 600;
    background: transparent;
    border: 0;
    border-radius: var(--bew-interactive-radius, 8px);
    cursor: pointer;
  }
  button:hover {
    background: var(--bew-fill-2, rgb(127 127 127 / 12%));
  }
  button.primary {
    color: white;
    background: var(--bew-theme-color, #00aeec);
  }
  button.primary:hover {
    background: var(--bew-theme-color-80, var(--bew-theme-color, #00aeec));
  }
  button:focus-visible {
    outline: 2px solid var(--bew-theme-color, #00aeec);
    outline-offset: 2px;
  }
`

function createButton(label: string, onClick: () => void, primary = false) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  if (primary)
    button.className = 'primary'
  button.addEventListener('click', onClick)
  return button
}

function renderBanner(state: SafariUpdateState, copy: SafariUpdateCopy) {
  const latest = state.latest!
  document.getElementById(BANNER_ID)?.remove()

  const bewlyContainer = document.querySelector<HTMLElement>('#bewly')
  const themeSource = bewlyContainer ?? document.documentElement
  const isDark = bewlyContainer
    ? bewlyContainer.classList.contains('dark')
    : document.documentElement.classList.contains('dark') || matchMedia('(prefers-color-scheme: dark)').matches

  const host = document.createElement('div')
  host.id = BANNER_ID
  host.dataset.theme = isDark ? 'dark' : 'light'
  host.style.setProperty('all', 'initial', 'important')
  host.style.setProperty('position', 'fixed', 'important')
  host.style.setProperty('left', '16px', 'important')
  host.style.setProperty('bottom', '16px', 'important')
  host.style.setProperty('z-index', '2147483646', 'important')
  host.style.setProperty('display', 'block', 'important')
  const themeStyles = getComputedStyle(themeSource)
  THEME_PROPERTIES.forEach((property) => {
    const value = themeStyles.getPropertyValue(property).trim()
    if (value)
      host.style.setProperty(property, value)
  })
  if (themeStyles.fontFamily)
    host.style.setProperty('font-family', themeStyles.fontFamily, 'important')

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = BANNER_CSS

  const banner = document.createElement('aside')
  banner.className = 'banner'
  banner.setAttribute('role', 'status')

  const title = document.createElement('h2')
  title.className = 'title'
  title.textContent = formatCopy(copy.title, latest.version)
  banner.append(title)

  if (latest.summary) {
    const summary = document.createElement('p')
    summary.textContent = latest.summary
    banner.append(summary)
  }
  for (const text of [copy.description, formatCopy(copy.currentVersion, state.currentVersion)]) {
    const paragraph = document.createElement('p')
    paragraph.textContent = text
    banner.append(paragraph)
  }

  const close = () => host.remove()
  const actions = document.createElement('div')
  actions.className = 'actions'
  actions.append(
    createButton(copy.ignore, () => {
      void updatePrefs({ ignoredVersion: latest.version })
      close()
    }),
    createButton(copy.later, () => {
      void updatePrefs({ snoozedUntil: Date.now() + UPDATE_SNOOZE_MS })
      close()
    }),
    createButton(copy.view, () => {
      window.open(latest.url, '_blank', 'noopener')
      close()
    }, true),
  )
  banner.append(actions)

  shadow.append(style, banner)
  document.body.append(host)
}

export async function mountSafariUpdateBanner() {
  if (isInIframe() || document.getElementById(BANNER_ID))
    return

  try {
    const state = await browser.runtime.sendMessage({ type: UPDATE_GET_STATE_MESSAGE }) as SafariUpdateState | undefined
    if (!state?.shouldNotify || !state.latest)
      return
    renderBanner(state, getSafariUpdateCopy(await getRefreshPromptLocale()))
  }
  catch {
    // 检查更新失败不影响其他功能。
  }
}
