/**
 * Client-side photo processing — PRD §7.
 *
 * Every garment photo is turned into two files before it leaves the phone: a
 * display-size original and a 1:1 thumbnail for the grid. Both are produced here
 * rather than by Supabase's image transform, which is a paid feature — doing it
 * on the client keeps the free tier viable and means the grid never waits on a
 * server-side resize.
 */

/** Long edge of the stored original. ~150KB at WebP q0.82 for a phone photo. */
export const FULL_MAX_EDGE = 1280
/** Grid thumbnails are square, so this is both width and height. */
export const THUMB_SIZE = 400

const FULL_QUALITY = 0.82
const THUMB_QUALITY = 0.8

export interface ProcessedPhoto {
  full: Blob
  thumb: Blob
  /** Dimensions of `full`, stored so the detail view can reserve space. */
  width: number
  height: number
  /** File extension matching what the browser actually encoded. */
  ext: 'webp' | 'jpg'
  /** Object URL for immediate preview. Revoke with `releasePreview`. */
  previewUrl: string
}

/**
 * Scales `width`×`height` down so its longer side is at most `maxEdge`.
 *
 * Never scales up — a photo that is already small stays as it is rather than
 * being interpolated into a larger, blurrier file.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }

  const scale = maxEdge / longest
  return {
    // Round, then floor at 1: a very wide panorama could otherwise round its
    // short side to 0 and produce a canvas that throws.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * The source rectangle to read when centre-cropping to a square.
 *
 * Garments are usually shot centred, so the middle is the safest crop; the grid
 * needs uniform squares or the columns stop lining up.
 */
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
 * Decodes a file, applying EXIF orientation.
 *
 * `createImageBitmap` with `imageOrientation: 'from-image'` is the direct route,
 * but it is not universally available, so an `<img>` element is the fallback —
 * browsers apply orientation when rendering those.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
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

function sourceSize(source: ImageBitmap | HTMLImageElement) {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height }
}

/**
 * Encodes a canvas, preferring WebP.
 *
 * Safari silently falls back to PNG when asked for a type it cannot encode,
 * which would triple the upload for no benefit — so the produced type is checked
 * and JPEG is used instead when WebP did not take.
 */
async function encode(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const webp = await toBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' }

  const jpeg = await toBlob(canvas, 'image/jpeg', quality)
  if (jpeg) return { blob: jpeg, ext: 'jpg' }

  throw new Error('이미지를 인코딩하지 못했어요.')
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function draw(
  source: CanvasImageSource,
  width: number,
  height: number,
  crop?: { sx: number; sy: number; size: number },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

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

/** Turns a picked file into the two blobs that get uploaded. */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const source = await decode(file)
  try {
    const { width: rawWidth, height: rawHeight } = sourceSize(source)
    if (!rawWidth || !rawHeight) throw new Error('이미지를 읽지 못했어요.')

    const full = fitWithin(rawWidth, rawHeight, FULL_MAX_EDGE)
    const fullCanvas = draw(source, full.width, full.height)
    const encodedFull = await encode(fullCanvas, FULL_QUALITY)

    const crop = coverCropRect(rawWidth, rawHeight)
    // Never upscale a small photo into a 400px square.
    const thumbEdge = Math.min(THUMB_SIZE, crop.size)
    const thumbCanvas = draw(source, thumbEdge, thumbEdge, crop)
    const encodedThumb = await encode(thumbCanvas, THUMB_QUALITY)

    return {
      full: encodedFull.blob,
      thumb: encodedThumb.blob,
      width: full.width,
      height: full.height,
      ext: encodedFull.ext,
      previewUrl: URL.createObjectURL(encodedThumb.blob),
    }
  } finally {
    if (!(source instanceof HTMLImageElement)) source.close()
  }
}

export function releasePreview(photo: ProcessedPhoto): void {
  URL.revokeObjectURL(photo.previewUrl)
}
