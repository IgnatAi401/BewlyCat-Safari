// WebKit 在 <img> 设置 src、<source> 增删 srcset 时立即重新选源并发起请求：
// Vue 动态创建 <picture> 时先给 <img> 设好 src 再插入 <picture>，于是先下载原格式、再下载 AVIF；
// LazyPicture 释放图片时逐个移除 <source> 的 srcset，又依次下载 WebP 和原格式。
// 同一张封面因此请求 3～4 次。Safari 版最低 18.4，支持 AVIF（与原先 <picture> 选中的格式相同），
// 改为不渲染 <source>、由 <img> 直接加载 AVIF，每张图只请求一次。
export const SAFARI_SINGLE_SOURCE_PICTURE = __SAFARI__

export function getSafariPictureImageSrc(src: string): string {
  return __SAFARI__ && src ? `${src}.avif` : src
}
