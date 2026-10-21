# BewlyCat-Safari 维护路线图

本仓库是 [keleus/BewlyCat](https://github.com/keleus/BewlyCat) 的非官方 Safari 适配版，面向自己和其他 Safari 用户。**以源码分发**：每个版本发布 GitHub Release（只含源码，不附构建产物、不做 App），用户下载或拉取源码、在本地构建后作为 Safari 临时扩展加载；扩展内置新版本提示。

## 1. 仓库与分支

| 名称 | 作用 | 规则 |
| --- | --- | --- |
| `origin` | `IgnatAi401/BewlyCat-Safari`，本仓库 | 可推送 |
| `upstream` | `keleus/BewlyCat`，上游 | 只拉取，不推送 |
| `main` | 上游 `main` 的镜像 | 只用 GitHub「Sync fork」或 `git merge --ff-only upstream/main` 更新，不在其上提交 |
| `safari` | Safari 版开发分支，设为 GitHub 默认分支，用户拉取的就是它 | 只追加提交，**禁止 rebase 和强制推送**；开启分支保护 |
| 功能分支 | `feat/xxx`、`fix/xxx`，从 `safari` 拉出 | 完成并实测后合并回 `safari` |

`safari` 分支的最新提交应始终可构建、可用；未测完的改动留在功能分支。

旧仓库 `IgnatAi401/BewlyCat-Safari-Local`（只存构建产物）在本仓库首个版本实测通过后归档，简介注明迁移到本仓库。

## 2. 只用本仓库的 Agent 指导文档

- `AGENTS.md`、`CLAUDE.md` 是本仓库自有版本。`.gitattributes` 中设为 `merge=ours`，合并上游时自动保留我们的版本（已实测）。
- `merge=ours` 依赖本地 Git 配置，**每次新克隆后执行一次**：`git config merge.ours.driver true`。没配置时上游改动这两个文件会产生冲突，此时用 `git checkout --ours AGENTS.md CLAUDE.md` 解决。
- 上游的 `docs/agent-*.md`、`docs/CONTRIBUTING*.md` 等文件保留不删（删除会在上游每次修改时产生冲突），由 `AGENTS.md` 声明不作为本仓库规则。

## 3. 代码组织

- Safari 专属逻辑集中放在 `src/safari/`（新文件，上游不会改动，几乎不产生冲突）。
- 上游文件中只保留最少的接入点，并用 `__SAFARI__` 包裹，例如 `if (__SAFARI__) applySafariSettingsFixes(record)`；接入点放在函数开头或结尾，不穿插在上游逻辑中间。
- 上游大文件（尤其 `src/inject/index.ts`、`src/logic/storage.ts`）不直接改写原有逻辑；确需改动时在下方清单登记。
- Safari 专属资源放在 `assets/` 下并以 `-safari` 结尾，如 `assets/rules-safari.json`。
- 查看 Safari 版相对上游的全部改动：`git diff <上游标签> safari`。

### 接入点清单

每个改动了上游文件的位置都登记在此，同步上游出现冲突时按此表核对。

| 上游文件 | 位置 | 用途 |
| --- | --- | --- |
| `.gitattributes` | 末尾 | `AGENTS.md`、`CLAUDE.md` 使用 `merge=ours` |
| `vite.config.ts` | `replace()` | 定义 `__SAFARI__` |
| `src/global.d.ts` | 顶部 | 声明 `__SAFARI__` |
| `src/manifest.ts` | `getManifest()` | 注入范围、权限、规则集、最低 Safari 18.4 |
| `src/logic/storage.ts` | 设置迁移 | 关闭抽屉打开方式与通知抽屉 |
| `src/composables/useDark.ts` | `syncBilibiliTheme()` | 主题切换转交页面脚本 |
| `src/inject/index.ts` | 评论区样式表、`message` 监听 | 评论区主题色、派发 `global.themeChange` |

（后 6 项待从旧仓库 `patches/safari.patch` 迁入后核对。）

## 4. 版本号与 Release

- 版本跟随上游：同步上游 `vX.Y.Z` 后发布 `vX.Y.Z-safari.1`；上游不变、只修 Safari 问题时序号加 1（`-safari.2`…）。Release 标题写作 `vX.Y.Z（Safari 第 N 版）`。
- 扩展版本号：`package.json` 的 `version` 保持上游原值（改它会在每次同步时冲突）。Safari 修订号单独放在 `src/safari/version.ts`（如 `SAFARI_REVISION = 1`），由 `src/manifest.ts` 在 Safari 构建时拼成 `manifest.version = "X.Y.Z.N"`。
- 每个 Release 只含 GitHub 自动附带的源码包，说明里写：基于的上游版本及上游更新要点链接、Safari 部分的新增与修复、已知问题、升级步骤。同样内容记入 `CHANGELOG-safari.md`。
- 发布：实测通过后 `git tag vX.Y.Z-safari.N && git push origin safari --tags`，再用 `gh release create vX.Y.Z-safari.N --notes-file <说明文件>` 或在网页上创建 Release。只有正式 Release 会触发用户的更新提示，草稿和预发布（pre-release）不会。

## 4.1 新版本提示（扩展内）

上游的「刷新提示」是商店自动更新后提醒刷新页面，依赖 `scripting` 权限，Safari 版不可用，也不能发现新版本。Safari 版自行实现：

- 后台定时（启动时及每 12 小时，结果缓存在 `storage.local`）请求 `https://api.github.com/repos/IgnatAi401/BewlyCat-Safari/releases/latest`，取 `tag_name` 解析出 `X.Y.Z.N`，与 `browser.runtime.getManifest().version` 比较。GitHub 未登录接口限 60 次/小时/IP，此频率足够。
- 有新版本时，在 B 站页面由内容脚本显示提示条：新版本号、更新摘要、「查看更新」（打开 Release 页）、「忽略此版本」、「稍后提醒」。不自动下载或安装。
- 设置中提供「检查更新」开关（默认开）和「立即检查」按钮；请求失败静默忽略，不影响扩展其他功能。
- 代码放在 `src/safari/updateCheck/`；接入点：后台入口一行启动、内容脚本一行挂载提示条、设置页一个开关，登记到接入点清单。
- 临时扩展无法自动更新：提示条只引导用户按第 7 节手动升级。

## 5. 同步上游

1. `git fetch upstream --tags`；更新 `main`：`git switch main && git merge --ff-only upstream/main && git push`（或在 GitHub 点「Sync fork」）。
2. `git switch safari && git merge <上游新标签>`，提交信息 `merge: 同步上游 vX.Y.Z`。
3. 解决冲突时对照「接入点清单」；上游新增的功能要判断在 Safari 下是否可用（是否依赖 iframe、抽屉、`scripting` 权限等），不可用的在 `src/safari/` 里关闭。
4. `pnpm install --frozen-lockfile`，`pnpm typecheck`，`pnpm build-safari`。
5. 按第 6 节测试清单在 Safari 中实测，通过后重置 `SAFARI_REVISION` 为 1，按第 4 节发布 Release。

## 6. 推送前测试清单

在 Safari 中移除旧临时扩展、重新添加 `extension-safari/` 后逐项检查：

- [ ] 首页、视频页、番剧页、稍后再看、历史记录
- [ ] 搜索、动态（t.bilibili.com）、个人空间、消息中心
- [ ] 登录、退出登录、接口请求（Origin/Referer 规则生效）
- [ ] 深色/浅色主题切换，B 站原生区域跟随
- [ ] 评论区：树状回复、用户名与链接主题色
- [ ] 设置页：抽屉相关选项已强制关闭
- [ ] 新版本提示：把本地版本号临时调低，确认提示条出现、链接正确、「忽略此版本」生效

## 7. 用户如何使用与更新

写进 README 的用户步骤：

**首次安装**

1. 安装 Node.js（版本见 `package.json` 的 `engines`）和 pnpm。
2. `git clone https://github.com/IgnatAi401/BewlyCat-Safari.git`，进入目录。
3. `pnpm install --frozen-lockfile`，然后 `pnpm build-safari`。
4. Safari → 设置 → 高级 → 勾选「显示网页开发者功能」；开发 → 开发者设置 → 「添加临时扩展」，选择 `extension-safari/` 文件夹。
5. 首次在 B 站页面授权扩展访问网站。

**接收更新**

- 扩展会在 B 站页面提示新版本；也可以在 GitHub 仓库点 Watch → Custom → Releases 接收邮件通知。
- 用 Git 更新：`git pull`（或 `git checkout <新标签>`），`pnpm install --frozen-lockfile`，`pnpm build-safari`，在 Safari 中移除旧临时扩展后重新添加。
- 不用 Git：在 Release 页下载「Source code (zip)」，解压后执行同样的构建与重新添加步骤。

**需要在 README 说明的限制**

- 临时扩展在 Safari 退出后通常会被移除，需要重新添加（不必重新构建）。
- 多语言路径（如 `/ja/video/...`）不在注入范围内；iframe 内页面保持 B 站原样式。

## 8. 许可证、署名与沟通

- 保留上游 `LICENSE` 原文与版权声明，不修改。上游禁止封装为桌面应用或独立客户端分发，因此不做 Xcode App 封装或上架。
- README 开头注明「非官方 Safari 适配版，基于 keleus/BewlyCat」并附链接，不以上游作者名义发布。
- Safari 专属问题在本仓库 Issues 处理，提供模板（Safari 版本、macOS 版本、仓库标签或提交号、出问题的网址）；上游通用问题引导到上游仓库。
- 不向上游提交本仓库专属文件（`AGENTS.md`、`CLAUDE.md`、`docs/safari/`、`src/safari/`）；通用修复想贡献上游时，单独从上游 `main` 拉分支提 PR。

## 9. 落地步骤

- [x] Fork 上游为 `IgnatAi401/BewlyCat-Safari`，配置 `upstream` 远程
- [x] 以 `v1.8.1` 为基础创建 `safari` 分支，写入自有 `AGENTS.md`、`CLAUDE.md`、本路线图和 `merge=ours` 规则
- [ ] 推送 `safari`，在 GitHub 设为默认分支并开启分支保护（禁止强推）
- [ ] 应用旧仓库的 `patches/safari.patch` 作为首个功能提交，构建并实测
- [ ] 将 Safari 逻辑重构到 `src/safari/`，更新接入点清单
- [ ] 实现新版本提示（第 4.1 节）与 `src/safari/version.ts` 版本号拼接
- [ ] 改写 README（安装、更新、已知限制）、新增 `CHANGELOG-safari.md` 和 Issue 模板
- [ ] 发布 Release `v1.8.1-safari.1`，实测通过后归档 `BewlyCat-Safari-Local`
- [ ] 同步上游最新版本（当前上游 `main` 已领先 `v1.8.1`）
