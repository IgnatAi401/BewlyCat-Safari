// Safari 版修订号：同步上游 vX.Y.Z 后重置为 1，只修 Safari 问题时加 1。
// 扩展版本号为「上游版本.修订号」，对应 Release 标签 vX.Y.Z-safari.N。
export const SAFARI_REVISION = 1

export function getSafariExtensionVersion(upstreamVersion: string): string {
  return `${upstreamVersion}.${SAFARI_REVISION}`
}
