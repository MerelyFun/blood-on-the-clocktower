import { copyFile, mkdir, readdir } from 'node:fs/promises';
const target = new URL('../public/ocr/', import.meta.url);
const modules = new URL('../node_modules/', import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(new URL('tesseract.js/dist/worker.min.js', modules), new URL('worker.min.js', target));
// Self-host every supported WASM variant so mobile browsers never depend on a third-party CDN.
for (const name of await readdir(new URL('tesseract.js-core/', modules))) {
  if (name.endsWith('.wasm.js')) await copyFile(new URL(`tesseract.js-core/${name}`, modules), new URL(name, target));
}
for (const lang of ['chi_sim', 'chi_tra']) {
  await copyFile(new URL(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, modules), new URL(`${lang}.traineddata.gz`, target));
}
await copyFile(new URL('tesseract.js/LICENSE.md', modules), new URL('LICENSE-tesseract.txt', target));
await copyFile(new URL('tesseract.js-core/LICENSE', modules), new URL('LICENSE-core.txt', target));
console.log('OCR worker, WebAssembly and language packs prepared.');
