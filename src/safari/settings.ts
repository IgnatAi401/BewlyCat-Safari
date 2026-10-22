// Safari 只向视频页 iframe 注入脚本（见 manifest.ts），依赖 iframe 的抽屉、弹窗打开方式必须关闭。
export function applySafariSettingsFixes(record: Record<string, any>) {
  record.openNotificationsPageAsDrawer = false
  if (record.videoCardLinkOpenMode === 'drawer' || record.videoCardLinkOpenMode === 'dialog')
    record.videoCardLinkOpenMode = 'newTab'

  // 旧版 Safari 本地包曾关闭这些功能；迁移一次，恢复为可用的默认值。
  if (Number(record.safariRestoredFeatureProfileVersion ?? 0) < 1) {
    record.enableCommentReplyTreeDisplay = true
    const momentsDockItem = Array.isArray(record.dockItemsConfig)
      ? record.dockItemsConfig.find((item: any) => item?.page === 'Moments')
      : null
    if (momentsDockItem)
      momentsDockItem.useOriginalBiliPage = false
    record.safariRestoredFeatureProfileVersion = 1
  }

  if (Array.isArray(record.videoCardContextMenuConfig)) {
    for (const item of record.videoCardContextMenuConfig) {
      if ((item?.key === 'openInDrawer' || item?.key === 'openInDialog') && item.visible)
        item.visible = false
    }
  }
}
