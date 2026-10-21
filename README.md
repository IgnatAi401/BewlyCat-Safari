# BewlyCat for Safari

基于 [keleus/BewlyCat](https://github.com/keleus/BewlyCat) 制作的 **Safari 浏览器适配版本**，并专门针对 Safari 做了性能优化，用于改善 Bilibili 网页的浏览体验。本项目为非官方适配，原项目及主要功能由上游作者和贡献者开发，感谢他们的工作。功能介绍见[上游 README](https://github.com/keleus/BewlyCat#readme)。

每个版本在 [Releases](https://github.com/IgnatAi401/BewlyCat-Safari/releases) 提供已构建的扩展压缩包，可在 macOS 的 Safari（18.4 或更高版本）中本地加载，无需安装依赖或编译。

## 本地使用

1. 在 [Releases](https://github.com/IgnatAi401/BewlyCat-Safari/releases) 下载最新版本的 `BewlyCat-Safari-<版本>.zip`（不是 Source code），并解压。
2. 打开 **Safari → 设置 → 高级**，勾选“显示网页开发者功能”。
3. 在 **Safari → 设置 → 开发者** 中勾选“允许未签名的扩展”，点击“添加临时扩展…”，选择解压后包含 `manifest.json` 的文件夹。
4. 在 **Safari → 设置 → 扩展** 中启用 BewlyCat，并允许访问 `bilibili.com` 和 `hdslb.com`。
5. 打开或刷新 [Bilibili](https://www.bilibili.com/) 即可使用。

临时扩展在 Safari 退出后通常会被移除，重新添加即可；不要同时启用多个 BewlyCat 版本。

## 更新

有新版本时，扩展会在 B 站页面左下角提示。下载新的压缩包并解压，在 **Safari → 设置 → 开发者** 中移除旧的临时扩展后重新添加；仅刷新网页不会加载新文件。

各版本改动见 [CHANGELOG-safari.md](CHANGELOG-safari.md)。Safari 版的问题请在[本仓库 Issues](https://github.com/IgnatAi401/BewlyCat-Safari/issues) 反馈，不要打扰上游。

# 请勿擅自发布至 App Store!!
