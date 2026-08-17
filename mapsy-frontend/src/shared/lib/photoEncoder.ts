/**
 * 클라이언트 사진 처리의 인코딩 코어 — PRD §7.
 *
 * 모든 옷 사진은 폰을 떠나기 전에 두 파일이 된다. 표시용 원본과 격자용 1:1 썸네일.
 * Supabase의 이미지 변환이 유료라 여기서 만든다.
 *
 * **이 파일은 메인 스레드와 워커 양쪽에서 돈다.** 그래서 DOM에 닿는 자리마다 가드가
 * 있고, 캔버스는 두 종류를 다룬다. 한 벌만 두는 이유는 사진이 어느 스레드에서
 * 처리됐는지에 따라 다른 바이트가 나오면 안 되기 때문이다.
 */

/** 저장되는 원본의 긴 변. */
export const FULL_MAX_EDGE = 1280
/** 격자 썸네일은 정사각이라 가로·세로 공용. */
export const THUMB_SIZE = 400

const FULL_QUALITY = 0.82
const THUMB_QUALITY = 0.8

/** 인코딩이 끝난 사진. 미리보기 URL은 이것을 받은 쪽이 붙인다. */
export interface EncodedPhoto {
  full: Blob
  thumb: Blob
  /** `full`의 크기. 상세 화면이 자리를 미리 잡는 데 쓴다. */
  width: number
  height: number
  /** 브라우저가 실제로 인코딩한 것과 맞는 확장자. */
  ext: 'webp' | 'jpg'
}

/** 긴 변이 `maxEdge` 이하가 되도록 줄인다. 키우지는 않는다. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }

  const scale = maxEdge / longest
  return {
    // 반올림 후 1로 바닥 — 아주 넓은 파노라마는 짧은 변이 0으로 반올림되어
    // 캔버스가 던진다.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** 정사각으로 가운데를 자를 때 읽을 원본 사각형. */
export function coverCropRect(
  width: number,
  height: number,
): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height)
  return {
    sx: Math.round((width - size) / 2),
    sy: Math.round((height - size) / 2),
    size,
  }
}

/**
 * EXIF 방향을 적용해 파일을 디코드한다.
 *
 * `createImageBitmap`의 `imageOrientation: 'from-image'`가 직행이지만 모든 곳에 있지는
 * 않아, `<img>`가 대체 경로다 — 브라우저는 그것을 그릴 때 방향을 적용한다.
 *
 * 그 대체 경로에는 DOM이 필요해서 워커에는 없다. 워커에서 여기까지 온 파일은 그대로
 * 실패하고 메인 스레드가 다시 해본다 — 그것이 워커 폴백의 존재 이유 중 하나다.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (bitmapError) {
    if (typeof document === 'undefined') throw bitmapError

    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/**
 * `HTMLImageElement`가 아니라 `ImageBitmap`으로 묻는다.
 *
 * 방향이 반대인 것은 워커 전역에 `HTMLImageElement`가 아예 없기 때문이다 — 거기서는
 * `instanceof`가 false가 아니라 ReferenceError다. `ImageBitmap`은 양쪽에 다 있다.
 */
function isBitmap(source: ImageBitmap | HTMLImageElement): source is ImageBitmap {
  return typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
}

function sourceSize(source: ImageBitmap | HTMLImageElement) {
  return isBitmap(source)
    ? { width: source.width, height: source.height }
    : { width: source.naturalWidth, height: source.naturalHeight }
}

type PhotoCanvas = HTMLCanvasElement | OffscreenCanvas

const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined'

/**
 * 캔버스를 인코딩한다. WebP를 먼저 시도한다.
 *
 * Safari는 인코딩할 수 없는 타입을 요청받으면 말없이 PNG로 떨어져 업로드가 세 배가
 * 된다. 그래서 나온 타입을 확인하고, WebP가 아니면 JPEG로 간다.
 */
async function encode(
  canvas: PhotoCanvas,
  quality: number,
): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const webp = await toBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' }

  const jpeg = await toBlob(canvas, 'image/jpeg', quality)
  if (jpeg) return { blob: jpeg, ext: 'jpg' }

  throw new Error('이미지를 인코딩하지 못했어요.')
}

/**
 * 두 캔버스의 답을 한 모양으로 접는다. 판단은 위에서 `blob.type`으로 한 번만 한다.
 *
 * 지원하지 않는 타입에 대한 답은 둘 다 PNG다 — 명세가 "serialization as a file"을
 * 공유한다. `catch`가 잡는 것은 그것이 아니라 오염된 캔버스 같은 실제 예외이고,
 * `null`로 접어 두면 위에서 JPEG 시도로 이어진다.
 */
function toBlob(canvas: PhotoCanvas, type: string, quality: number): Promise<Blob | null> {
  if (hasOffscreenCanvas && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality }).catch(() => null)
  }
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality))
}

/**
 * 아래 `document`는 워커에 없다. 워커는 `OffscreenCanvas`가 있을 때만 만들어지므로
 * (`image.ts`의 `getWorker`) 거기서는 첫 줄에서 돌아간다 — 그 조건을 지우면 이 함수가
 * 워커에서 ReferenceError를 던진다.
 */
function createCanvas(width: number, height: number): PhotoCanvas {
  if (hasOffscreenCanvas) return new OffscreenCanvas(width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function draw(
  source: CanvasImageSource,
  width: number,
  height: number,
  crop?: { sx: number; sy: number; size: number },
): PhotoCanvas {
  const canvas = createCanvas(width, height)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 초기화하지 못했어요.')

  ctx.imageSmoothingQuality = 'high'
  if (crop) {
    ctx.drawImage(source, crop.sx, crop.sy, crop.size, crop.size, 0, 0, width, height)
  } else {
    ctx.drawImage(source, 0, 0, width, height)
  }
  return canvas
}

/** 고른 파일을 업로드될 두 blob으로 바꾼다. */
export async function encodePhoto(file: File): Promise<EncodedPhoto> {
  const source = await decode(file)
  try {
    const { width: rawWidth, height: rawHeight } = sourceSize(source)
    if (!rawWidth || !rawHeight) throw new Error('이미지를 읽지 못했어요.')

    const full = fitWithin(rawWidth, rawHeight, FULL_MAX_EDGE)
    const fullCanvas = draw(source, full.width, full.height)
    const encodedFull = await encode(fullCanvas, FULL_QUALITY)

    const crop = coverCropRect(rawWidth, rawHeight)
    // 작은 사진을 400px 정사각으로 키우지 않는다.
    const thumbEdge = Math.min(THUMB_SIZE, crop.size)
    const thumbCanvas = draw(source, thumbEdge, thumbEdge, crop)
    const encodedThumb = await encode(thumbCanvas, THUMB_QUALITY)

    return {
      full: encodedFull.blob,
      thumb: encodedThumb.blob,
      width: full.width,
      height: full.height,
      ext: encodedFull.ext,
    }
  } finally {
    if (isBitmap(source)) source.close()
  }
}
