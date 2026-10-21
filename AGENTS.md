# BewlyCat-Safari Agent 指南

本仓库 `IgnatAi401/BewlyCat-Safari` 是上游 [keleus/BewlyCat](https://github.com/keleus/BewlyCat) 的非官方 Safari 适配版：bilibili 浏览器扩展，Vue 3、TypeScript、Vite、UnoCSS、`pnpm`。仓库结构、同步上游、发布与用户使用方式见 [Safari 路线图](docs/safari/ROADMAP.md)，相关任务先读它。

## 只遵循本仓库的指导文档

- 本文件和 `CLAUDE.md` 是本仓库自有版本，合并上游时通过 `.gitattributes` 的 `merge=ours` 保留，不接受上游改动。
- 上游的 Agent / 开发流程文档不作为本仓库规则，不主动加载：`docs/agent-style-guide.md`、`docs/agent-pr-review.md`、`docs/CONTRIBUTING*.md`、`.github/scripts/pr-policy-check.mjs`。只在需要了解上游现有写法时当作参考资料查阅，与本文冲突时以本文为准。

## 分支与 Git

- 开发在 `safari` 分支（默认分支）；`main` 只镜像上游，不在其上提交。
- `safari` 已公开、有其他用户在拉取：同步上游用 `git merge`，**禁止 rebase、改写历史和强制推送**。
- 提交使用 Conventional Commits，冒号后用中文（如 `fix: 修复 Safari 下主题切换`）；同步上游用 `merge: 同步上游 vX.Y.Z`。
- 提交、推送、合并上游须用户明确授权；不丢弃或混入用户现有修改。
- 不向上游提交本仓库专属文件（`AGENTS.md`、`CLAUDE.md`、`docs/safari/`、`src/safari/`）。

## 代码组织

- Safari 专属逻辑放在 `src/safari/`；上游文件只加用 `__SAFARI__` 包裹的最少接入点，放在函数开头或结尾，并登记到路线图的「接入点清单」。
- 不直接改写上游大文件（`src/inject/index.ts`、`src/logic/storage.ts` 等）的原有逻辑。
- Safari 专属资源以 `-safari` 结尾，如 `assets/rules-safari.json`。
- 代码定位：页面注入 `src/contentScripts/`、页面脚本 `src/inject/`、后台 `src/background/`、清单 `src/manifest.ts`、UI `src/components/`、设置 `src/logic/storage.ts`、翻译 `src/_locales/`。主 UI 在 Shadow DOM 内，样式用 `src/styles/variables.scss` 的 token。

## 检查与验证

- 静态检查：`pnpm exec eslint <相关文件>`、`pnpm typecheck`；改动 Safari 构建相关内容时运行 `pnpm build-safari`，产物在 `extension-safari/`。
- 本仓库以源码 Release 分发，不发布构建产物，`extension-safari/` 不提交；版本号与 Release 规则见路线图第 4 节。
- 只在用户要求时做浏览器实测；实测在真实 Safari 中加载 `extension-safari/` 进行，不用模拟页面代替。
- 结束时说明改动、实际运行的检查及结果、未解决事项。

## 许可证

- 保留上游 `LICENSE` 原文，不修改。上游禁止封装为桌面应用或独立客户端分发；不做 Xcode App 封装或上架。
