# BewlyCat for Safari 更新记录

只记录 Safari 适配部分的改动；上游功能更新见各版本对应的[上游 Release](https://github.com/keleus/BewlyCat/releases)。

## v1.8.1-safari.1（2026-10-21）

基于上游 [v1.8.1](https://github.com/keleus/BewlyCat/releases/tag/v1.8.1)。本仓库取代旧的 `BewlyCat-Safari-Local`，构建好的扩展改为附在 Release 中下载。

### 新增

- 扩展内新版本提示：定期检查本仓库的 GitHub Release，有新版本时在 B 站页面提示，可「查看更新」「忽略此版本」「稍后提醒」；「设置 → 关于」中可关闭检查或立即检查。上游的首页「新版本说明」按钮、「新版本提醒」开关和关于页 NEW 标记（指向上游仓库）在 Safari 版中隐藏。
- 扩展版本号带 Safari 修订号（如 `1.8.1.1`）。

### Safari 适配（从旧版 `safari.patch` 迁入）

- 使用 `declarativeNetRequestWithHostAccess` 和 Safari 专用请求头规则，最低 Safari 18.4。
- 只注入 BewlyCat 接管的页面且不注入 iframe；抽屉打开方式与通知抽屉强制关闭。
- 主题切换由页面脚本通知 B 站，原生区域跟随深色/浅色主题。
- 评论区用户名与链接跟随主题色。
- 多语言路径（如 `/ja/video/...`）和带参数的首页（如 `/?spm_id_from=...`）也会注入。

### 修复

- APP 客户端请求头规则加载失败：Safari 不支持规则正则中的 `|` 和 `sec-ch-ua*` 请求头，改为拆分规则（也影响「阻止跳转移动版」规则）。
- 后台 `cookies.onChanged` 报错：Safari 的事件不带参数，登录态变化改由 nav 接口判断后再通知各标签页。
- 接口缓存不区分账号：Safari 的 `cookies` API 读不到 B 站 Cookie，改用 nav 接口得到的账号作为缓存键，切换账号后不再看到上一个账号的缓存内容。
- 深色模式下评论区文字发暗、分隔线与评论输入栏发白：Safari 会把扩展样式表应用到 B 站评论组件的 Shadow DOM 内，其中 `:host` 的浅色变量盖过了深色变量，构建时改为只作用于 BewlyCat 自身容器。

### 性能

- 视频封面与头像每张只下载一次：WebKit 处理动态创建的 `<picture>` 时会先后下载原格式、AVIF 和 WebP，首页滚动时的图片请求约减少三分之二，改为 `<img>` 直接加载 AVIF（与原先 Safari 选用的格式相同）。
- 首页滚动时不再每帧把滚动位置同步到文档，停止滚动后再同步，滚动时标签页 CPU 占用降低。
- 被 BewlyCat 隐藏的 B 站原首页不再在后台连续加载 10 页推荐（含约 200 张封面和数千个不可见节点）；在设置中切回原版首页后照常加载。
- 评论区滚动更流畅：评论组件渲染后会重算回复树，同一楼层一帧内常重复重算 2～4 次并强制同步布局，现合并为每帧一次；重算改变楼层高度后也不再紧接着多算一遍。滚动加载评论时回复树的重算次数约减少三分之一（登录后评论加载更多时差别明显）。
- 动态页空闲时 CPU 占用从约 20% 降到约 5%：左侧「正在直播」头像角标的逐帧动画在 Safari 中每帧都要重绘，现停在第一帧（仍显示「直播中」）。
- 新增 Safari 性能测试脚本 `scripts/safari/perf.mjs`，用法见 [路线图](docs/safari/ROADMAP.md) 第 6.1 节。

### 已知问题

- iframe 内页面保持 B 站原样式；视频卡片「在抽屉中打开」和通知抽屉不可用。

### 升级步骤

从旧的 `BewlyCat-Safari-Local` 迁移：在 Safari 中移除旧的临时扩展，按 [README](README.md) 的「本地使用」下载并添加本版本。
