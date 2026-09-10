import type { Worker } from 'tesseract.js';

export interface OcrProgress { label: string; progress: number }
export async function recognizeScriptImage(file: File, options: {
  signal: AbortSignal; columns: number; traditional: boolean;
  onProgress: (progress: OcrProgress) => void;
}): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。');
  if (file.size > 15 * 1024 * 1024) throw new Error('图片超过 15 MB，请压缩后再试。');
  const { signal, onProgress } = options;
  let worker: Worker | undefined;
  let bitmap: ImageBitmap | undefined;
  let rejectJob: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => { rejectJob = reject; });
  // Attach immediately: cancellation may occur while the library is loading.
  void stopped.catch(() => {});
  const abort = () => { rejectJob(new Error('识别已取消')); void worker?.terminate(); };
  signal.addEventListener('abort', abort, { once: true });
  const timeout = window.setTimeout(() => { rejectJob(new Error('识别超时。请换用更清晰的小图，或分栏重试。')); void worker?.terminate(); }, 180_000);
  let ended = false;
  try {
    signal.throwIfAborted();
    onProgress({ label: '正在读取图片', progress: 0 });
    bitmap = await createImageBitmap(file);
    signal.throwIfAborted();
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('图片尺寸过大，请裁剪到剧本区域后重试。');
    const scale = Math.min(1.5, 3000 / Math.max(bitmap.width, bitmap.height), Math.sqrt(6_000_000 / (bitmap.width * bitmap.height)));
    const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
    const { createWorker, PSM } = await import('tesseract.js');
    signal.throwIfAborted();
    const root = new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin).href;
    let column = 0, pass = 0;
    const creating = createWorker(options.traditional ? 'chi_tra' : 'chi_sim', 1, {
      workerPath: `${root}worker.min.js`, corePath: root, langPath: root.replace(/\/$/, ''),
      workerBlobURL: false, cachePath: 'bt-ocr-v1',
      errorHandler: () => rejectJob(new Error('识别引擎加载失败，请检查网络后重试。')),
      logger: ({ status, progress }) => {
        if (ended || signal.aborted) return;
        const recognizing = status === 'recognizing text';
        onProgress({ label: recognizing ? `${pass ? '正在复核' : '正在识别'}${options.columns > 1 ? `第 ${column + 1} 栏` : '角色文字'}` : '正在加载识别引擎（首次稍慢）', progress: recognizing ? 20 + (column * 2 + pass + progress) / (options.columns * 2) * 80 : Math.round(progress * 18) });
      },
    }).then(w => { if (ended || signal.aborted) { void w.terminate(); throw new Error('识别已取消'); } worker = w; return w; });
    worker = await Promise.race([creating, stopped]);
    const texts: string[] = [];
    for (column = 0; column < options.columns; column++) {
      signal.throwIfAborted();
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width / options.columns); canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器无法读取图片，请换用系统浏览器。');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, bitmap.width * column / options.columns, 0, bitmap.width / options.columns, bitmap.height, 0, 0, canvas.width, height);
      try {
        // Sparse headings and full text blocks fail differently on illustrated scripts.
        // Merge both passes; the matching layer deduplicates roles for review.
        for (pass = 0; pass < 2; pass++) {
          await Promise.race([worker.setParameters({ tessedit_pageseg_mode: pass ? PSM.SINGLE_BLOCK : PSM.SPARSE_TEXT, preserve_interword_spaces: '1' }), stopped]);
          const result = await Promise.race([worker.recognize(canvas), stopped]);
          texts.push(result.data.text);
        }
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    const text = texts.join('\n');
    if (options.traditional) {
      const { Converter } = await import('opencc-js/t2cn');
      return Converter({ from: 't', to: 'cn' })(text);
    }
    return text;
  } finally {
    ended = true; clearTimeout(timeout); signal.removeEventListener('abort', abort);
    bitmap?.close(); await worker?.terminate();
  }
}
