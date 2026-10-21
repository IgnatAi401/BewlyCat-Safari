# BewlyCat-Safari 维护路线图

本仓库是 [keleus/BewlyCat](https://github.com/keleus/BewlyCat) 的非官方 Safari 适配版，面向自己和其他 Safari 用户。**只以源码分发**：不发布构建产物、不打包 zip、不做 App。用户克隆源码、在本地构建后作为 Safari 临时扩展加载。

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

## 4. 版本标记

- 不发布 Release。每次同步上游或完成一批修复并实测后，打一个标签标记稳定点：`v<上游版本>-safari.<序号>`，如 `v1.8.1-safari.1`；上游不变只修 Safari 问题时序号加 1，同步新上游后从 1 重新开始。
- `CHANGELOG-safari.md` 按标签记录：基于的上游版本、Safari 部分的新增与修复、已知问题。用户通过它了解每次更新的内容。

## 5. 同步上游

1. `git fetch upstream --tags`；更新 `main`：`git switch main && git merge --ff-only upstream/main && git push`（或在 GitHub 点「Sync fork」）。
2. `git switch safari && git merge <上游新标签>`，提交信息 `merge: 同步上游 vX.Y.Z`。
3. 解决冲突时对照「接入点清单」；上游新增的功能要判断在 Safari 下是否可用（是否依赖 iframe、抽屉、`scripting` 权限等），不可用的在 `src/safari/` 里关闭。
4. `pnpm install --frozen-lockfile`，`pnpm typecheck`，`pnpm build-safari`。
5. 按第 6 节测试清单在 Safari 中实测，通过后更新 `CHANGELOG-safari.md`、打标签、推送：`git push origin safari --tags`。

## 6. 推送前测试清单

在 Safari 中移除旧临时扩展、重新添加 `extension-safari/` 后逐项检查：

- [ ] 首页、视频页、番剧页、稍后再看、历史记录
- [ ] 搜索、动态（t.bilibili.com）、个人空间、消息中心
- [ ] 登录、退出登录、接口请求（Origin/Referer 规则生效）
- [ ] 深色/浅色主题切换，B 站原生区域跟随
- [ ] 评论区：树状回复、用户名与链接主题色
- [ ] 设置页：抽屉相关选项已强制关闭

## 7. 用户如何使用与更新

写进 README 的用户步骤：

**首次安装**

1. 安装 Node.js（版本见 `package.json` 的 `engines`）和 pnpm。
2. `git clone https://github.com/IgnatAi401/BewlyCat-Safari.git`，进入目录。
3. `pnpm install --frozen-lockfile`，然后 `pnpm build-safari`。
4. Safari → 设置 → 高级 → 勾选「显示网页开发者功能」；开发 → 开发者设置 → 「添加临时扩展」，选择 `extension-safari/` 文件夹。
5. 首次在 B 站页面授权扩展访问网站。

**接收更新**

- 在 GitHub 仓库点 Watch → Custom → 勾选需要的通知（或关注 `CHANGELOG-safari.md`）。
- 更新：`git pull`，`pnpm install --frozen-lockfile`，`pnpm build-safari`，在 Safari 中移除旧临时扩展后重新添加。
- 想停在某个稳定版本：`git checkout v1.8.1-safari.1` 后构建。

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
- [ ] 改写 README（安装、更新、已知限制）、新增 `CHANGELOG-safari.md` 和 Issue 模板
- [ ] 打标签 `v1.8.1-safari.1`，实测通过后归档 `BewlyCat-Safari-Local`
- [ ] 同步上游最新版本（当前上游 `main` 已领先 `v1.8.1`）
