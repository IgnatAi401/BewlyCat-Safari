# BewlyCat for Safari 更新记录

只记录 Safari 适配部分的改动；上游功能更新见各版本对应的[上游 Release](https://github.com/keleus/BewlyCat/releases)。

## v1.8.1-safari.1（未发布）

基于上游 [v1.8.1](https://github.com/keleus/BewlyCat/releases/tag/v1.8.1)。本仓库改为源码分发，取代只存构建产物的 `BewlyCat-Safari-Local`。

### 新增

- 扩展内新版本提示：定期检查本仓库的 GitHub Release，有新版本时在 B 站页面提示，可「查看更新」「忽略此版本」「稍后提醒」；「设置 → 关于」中可关闭检查或立即检查。
- 扩展版本号带 Safari 修订号（如 `1.8.1.1`）。

### Safari 适配（从旧版 `safari.patch` 迁入）

- 使用 `declarativeNetRequestWithHostAccess` 和 Safari 专用请求头规则，最低 Safari 18.4。
- 只注入 BewlyCat 接管的页面且不注入 iframe；抽屉打开方式与通知抽屉强制关闭。
- 主题切换由页面脚本通知 B 站，原生区域跟随深色/浅色主题。
- 评论区用户名与链接跟随主题色。

### 修复

- APP 客户端请求头规则加载失败：Safari 不支持规则正则中的 `|` 和 `sec-ch-ua*` 请求头，改为拆分规则（也影响「阻止跳转移动版」规则）。
- 后台 `cookies.onChanged` 报错：Safari 的事件不带参数，登录态变化改由 nav 接口判断后再通知各标签页。

### 已知问题

- 多语言路径（如 `/ja/video/...`）不在注入范围内；iframe 内页面保持 B 站原样式。
- Safari 的 `cookies` API 读不到 B 站 Cookie：接口缓存无法按账号区分，切换账号后短时间内可能看到上一个账号的缓存内容。

### 升级步骤

从旧的 `BewlyCat-Safari-Local` 迁移：在 Safari 中移除旧的临时扩展，按 [README](README.md) 的「首次安装」构建并添加本版本。
