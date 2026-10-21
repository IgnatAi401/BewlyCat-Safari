# BewlyCat-Safari 维护路线图

本仓库是 [keleus/BewlyCat](https://github.com/keleus/BewlyCat) 的非官方 Safari 适配版，面向自己和其他 Safari 用户。本文记录仓库结构、同步上游、版本发布和用户分发的约定。

## 1. 仓库与分支

| 名称 | 作用 | 规则 |
| --- | --- | --- |
| `origin` | `IgnatAi401/BewlyCat-Safari`，本仓库 | 可推送 |
| `upstream` | `keleus/BewlyCat`，上游 | 只拉取，不推送 |
| `main` | 上游 `main` 的镜像 | 只用 GitHub「Sync fork」或 `git merge --ff-only upstream/main` 更新，不在其上提交 |
| `safari` | Safari 版开发与发布分支，设为 GitHub 默认分支 | 只追加提交，**禁止 rebase 和强制推送**；开启分支保护 |
| 功能分支 | `feat/xxx`、`fix/xxx`，从 `safari` 拉出 | 完成后合并回 `safari` |

旧仓库 `IgnatAi401/BewlyCat-Safari-Local`（只存构建产物）在本仓库发布首个 Release 并实测通过后归档，简介注明迁移到本仓库。

## 2. 代码组织

- Safari 专属逻辑集中放在 `src/safari/`（新文件，上游不会改动，几乎不产生冲突）。
- 上游文件中只保留最少的接入点，并用 `__SAFARI__` 包裹，例如 `if (__SAFARI__) applySafariSettingsFixes(record)`；接入点放在函数开头或结尾，不穿插在上游逻辑中间。
- 上游大文件（尤其 `src/inject/index.ts`、`src/logic/storage.ts`）不直接改写原有逻辑；确需改动时在本文「接入点清单」登记。
- Safari 专属资源放在 `assets/` 下并以 `-safari` 结尾，如 `assets/rules-safari.json`。
- 查看 Safari 版相对上游的全部改动：`git diff <上游标签> safari`。

### 接入点清单

迁移完成后在此登记每个改动了上游文件的位置（文件、函数、用途），同步上游出现冲突时按此表核对。

| 上游文件 | 位置 | 用途 |
| --- | --- | --- |
| `vite.config.ts` | `replace()` | 定义 `__SAFARI__` |
| `src/global.d.ts` | 顶部 | 声明 `__SAFARI__` |
| `src/manifest.ts` | `getManifest()` | 注入范围、权限、规则集、最低 Safari 18.4 |
| `src/logic/storage.ts` | 设置迁移 | 关闭抽屉打开方式与通知抽屉 |
| `src/composables/useDark.ts` | `syncBilibiliTheme()` | 主题切换转交页面脚本 |
| `src/inject/index.ts` | 评论区样式表、`message` 监听 | 评论区主题色、派发 `global.themeChange` |

## 3. 版本号

- Git 标签与 Release 名：`v<上游版本>-safari.<序号>`，如 `v1.8.1-safari.1`；上游不变只修 Safari 问题时序号加 1，同步新上游后序号从 1 重新开始。
- `manifest.json` 的 `version` 只能是数字：写成 `<上游版本>.<序号>`，如 `1.8.1.1`。
- 每次发布在 `CHANGELOG-safari.md` 记录：基于的上游版本、Safari 部分的新增与修复、已知问题。

## 4. 同步上游

1. `git fetch upstream --tags`，更新 `main`：`git switch main && git merge --ff-only upstream/main && git push`（或在 GitHub 点「Sync fork」）。
2. `git switch safari && git merge <上游新标签>`，提交信息 `merge: 同步上游 vX.Y.Z`。
3. 解决冲突时对照「接入点清单」；上游新增的功能要判断在 Safari 下是否可用（是否依赖 iframe、抽屉、`scripting` 权限等），不可用的在 `src/safari/` 里关闭。
4. `pnpm install --frozen-lockfile`，`pnpm typecheck`，`pnpm build-safari`。
5. 按第 6 节测试清单在 Safari 中实测。

## 5. 发布

1. 更新 `CHANGELOG-safari.md` 和版本号，提交到 `safari`。
2. 打标签并推送：`git tag v1.8.1-safari.1 && git push origin safari --tags`。
3. 发布 GitHub Release，上传 `extension-safari/` 打包的 zip，写明更新内容与安装/升级步骤。
4. （计划）用 GitHub Actions 在推送 `v*-safari.*` 标签时自动构建、打包并创建 Release，保证安装包与标签源码一致。

## 6. 发布前测试清单

在 Safari 中移除旧临时扩展、重新添加后逐项检查，结果写入 Release 说明：

- [ ] 首页、视频页、番剧页、稍后再看、历史记录
- [ ] 搜索、动态（t.bilibili.com）、个人空间、消息中心
- [ ] 登录、退出登录、接口请求（Origin/Referer 规则生效）
- [ ] 深色/浅色主题切换，B 站原生区域跟随
- [ ] 评论区：树状回复、用户名与链接主题色
- [ ] 设置页：抽屉相关选项已强制关闭

## 7. 用户分发与更新

| 阶段 | 方式 | 用户如何获得更新 |
| --- | --- | --- |
| 当前 | Release 中的 zip，用户在 Safari 开发者设置中「添加临时扩展」 | 在仓库点 Watch → Custom → Releases 接收邮件通知，下载新 zip，移除旧扩展后重新添加 |
| 开发者用户 | `git clone` 本仓库 `safari` 分支自行构建 | `git pull` 后重新 `pnpm build-safari` 并重新加载 |
| 可选 | 扩展内「检查更新」提示：请求 GitHub Releases API 比较版本号，可在设置中关闭 | 扩展提示有新版本，仍需手动替换 |

注意：临时扩展在 Safari 退出后通常会被移除，需要重新添加，README 中要写清楚。

### 关于 Xcode 打包成 macOS App

上游 LICENSE 在 MIT 基础上**禁止将本插件封装、转换、打包为独立客户端或桌面应用并分发**。Safari 正式安装扩展需要一个 macOS 容器 App，这可能落入该限制。**在取得上游作者 keleus 的书面许可之前，不做 App 封装或上架 App Store**，只以扩展源码和 zip 形式分发。

## 8. 许可证、署名与沟通

- 保留上游 `LICENSE` 原文与版权声明，不修改。
- README 开头注明「非官方 Safari 适配版，基于 keleus/BewlyCat」并附链接；扩展显示名区分为「BewlyCat for Safari」之类，不以上游作者名义发布。
- Safari 专属问题在本仓库 Issues 处理，提供模板（Safari 版本、macOS 版本、扩展版本、出问题的网址）；上游通用问题引导到上游仓库。
- 不向上游提交 `AGENTS.md`、`docs/safari/` 等本仓库专属文件；若有通用修复想贡献上游，单独从上游 `main` 拉分支提 PR。

## 9. 落地步骤

- [x] Fork 上游为 `IgnatAi401/BewlyCat-Safari`，配置 `upstream` 远程
- [x] 以 `v1.8.1` 为基础创建 `safari` 分支，写入 `AGENTS.md` 与本路线图
- [ ] 推送 `safari`，在 GitHub 设为默认分支并开启分支保护（禁止强推）
- [ ] 应用旧仓库的 `patches/safari.patch` 作为首个功能提交，构建并实测
- [ ] 将 Safari 逻辑重构到 `src/safari/`，更新接入点清单
- [ ] 编写 README（安装、更新、已知限制）、`CHANGELOG-safari.md`、Issue 模板
- [ ] 配置 GitHub Actions 自动构建与发布
- [ ] 发布 `v1.8.1-safari.1`，实测通过后归档 `BewlyCat-Safari-Local`
- [ ] 同步上游最新版本（当前上游 `main` 已领先 `v1.8.1`）
- [ ] （可选）扩展内检查更新提示
