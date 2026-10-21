# BewlyCat for Safari

> [!IMPORTANT]
> **非官方 Safari 适配版**，基于 [keleus/BewlyCat](https://github.com/keleus/BewlyCat)（BewlyCat 又基于 [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly)）。功能与主要代码均来自上游作者和贡献者，感谢他们的工作。本仓库只做让它在 Safari 中正常运行所需的最少改动。
>
> 请勿将本项目封装为 App 或上架 App Store，也不要以上游作者名义发布。Safari 版的问题请在[本仓库 Issues](https://github.com/IgnatAi401/BewlyCat-Safari/issues) 反馈，不要打扰上游。

<p align="center">
<img width="200" alt="BewlyCat icon" src="./assets/icon-512.png">
</p>

功能介绍见[上游 README](https://github.com/keleus/BewlyCat#readme)。本仓库**以源码分发**：每个版本发布一个 [GitHub Release](https://github.com/IgnatAi401/BewlyCat-Safari/releases)（只含源码），你在自己的 Mac 上构建后，作为 Safari 临时扩展加载。

## 环境要求

- macOS + Safari 18.4 或更高版本
- [Node.js](https://nodejs.org/) LTS 版本和 [pnpm](https://pnpm.io/)，例如用 Homebrew 安装：

  ```bash
  brew install node pnpm
  ```

## 首次安装

1. 下载源码（二选一）：
   - 用 Git：`git clone https://github.com/IgnatAi401/BewlyCat-Safari.git`，然后 `cd BewlyCat-Safari`。
   - 不用 Git：在 [Releases](https://github.com/IgnatAi401/BewlyCat-Safari/releases) 下载最新版本的「Source code (zip)」并解压，在终端进入解压后的文件夹。
2. 安装依赖并构建：

   ```bash
   pnpm install --frozen-lockfile
   ```

   ```bash
   pnpm build-safari
   ```

   完成后会生成 `extension-safari/` 文件夹。
3. 打开 **Safari → 设置 → 高级**，勾选「显示网页开发者功能」。
4. 打开 **Safari → 设置 → 开发者**，勾选「允许未签名的扩展」，点击「添加临时扩展…」，选择第 2 步生成的 `extension-safari/` 文件夹（里面直接有 `manifest.json`；不要选仓库根目录）。
5. 在 **Safari → 设置 → 扩展** 中启用 BewlyCat，并允许它访问 `bilibili.com` 和 `hdslb.com`（也可以在首次打开 B 站时按提示授权）。
6. 打开或刷新 [Bilibili](https://www.bilibili.com/) 即可使用。

> [!NOTE]
> 不要同时启用多个 BewlyCat（例如商店版和本版本）。

## 更新

扩展会定期检查本仓库的新 Release，有新版本时在 B 站页面左下角提示（可在「设置 → 关于 → BewlyCat Safari」关闭或立即检查）。也可以在 GitHub 仓库点 **Watch → Custom → Releases** 接收邮件通知。

临时扩展不能自动更新，需要手动升级：

1. 获取新源码：
   - 用 Git：在仓库目录执行 `git pull`（或 `git checkout <新版本标签>`）。
   - 不用 Git：下载新版本的「Source code (zip)」并解压。
2. 重新执行 `pnpm install --frozen-lockfile` 和 `pnpm build-safari`。
3. 在 **Safari → 设置 → 开发者** 中移除旧的临时扩展，再重新添加 `extension-safari/`。只刷新网页不会加载新文件。

## 已知限制

- 临时扩展在 Safari 退出后通常会被移除，下次需要重新添加（不必重新构建）。
- 为保证稳定，扩展不注入 iframe，因此视频卡片「在抽屉中打开」和通知抽屉已强制关闭，改为新标签页打开；动态页视频弹窗等 iframe 内页面保持 B 站原样式。
- 多语言路径（如 `/ja/video/...`）不在注入范围内。
- 上游的「扩展更新后刷新页面」提示依赖 Safari 不支持的权限，Safari 版改用上面的新版本提示。

## 版本号

版本跟随上游：基于上游 `vX.Y.Z` 的第 N 个 Safari 版标签为 `vX.Y.Z-safari.N`，扩展内显示为 `X.Y.Z.N`。各版本的 Safari 部分改动见 [CHANGELOG-safari.md](CHANGELOG-safari.md)。

## 问题反馈

- Safari 版特有的问题：在[本仓库提交 Issue](https://github.com/IgnatAi401/BewlyCat-Safari/issues/new/choose)，附上 Safari 版本、macOS 版本、版本标签或提交号、出问题的网址。
- 在 Chrome / Edge / Firefox 官方版中也能复现的问题：请反馈到[上游仓库](https://github.com/keleus/BewlyCat/issues)。

## 许可证与鸣谢

本项目遵循上游的 [LICENSE](LICENSE)（在 MIT 基础上禁止封装为客户端或 App 分发）。感谢 [BewlyCat](https://github.com/keleus/BewlyCat)、[BewlyBewly](https://github.com/BewlyBewly/BewlyBewly) 及其全部贡献者。
