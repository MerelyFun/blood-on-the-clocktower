# 图片转剧本 JSON

“剧本工坊 → 图片转 JSON”可从 JPG、PNG 或 WebP 图片中识别角色名称，并生成可继续编辑的剧本。

## 使用方法

1. 选择不超过 15 MB 的剧本图片。
2. 选择单栏、两栏或三栏；繁体图片可启用繁体识别。
3. 开始识别后，对照原图删除误选并补充遗漏角色。
4. 必要时展开识别原文进行校正，再重新匹配。
5. 填写剧本名称，下载通用 JSON，或直接放入剧本工坊继续编辑。

识别结果必须人工核对。小字、花体、倾斜拍摄、低对比背景和图标遮挡都可能造成漏识别或误识别。工具只会匹配已有角色目录，不会自动编造自制角色能力；未知角色需在剧本工坊中手动补全。

## 输出格式

通用 JSON 的数组首项是 `_meta`，包含剧本名称和作者；后续项目是角色 ID 或完整的自制角色定义。剧本图片、OCR 原文和房间存档不会写入输出。

原始扩展字段会在导入和再次导出时尽量保留，但不会作为脚本执行，也不会直接渲染为 HTML。

## 本地处理与依赖

- 图片和识别文本只在浏览器中处理，不上传到 Supabase。
- Tesseract.js 按需加载；WASM、Worker 和简繁中文语言包由站点静态提供。
- 首次识别需要加载数 MB 资源，之后可使用浏览器缓存。
- 原图会按尺寸缩放并按栏处理，以控制手机内存占用。
- 识别支持取消，并设有超时和资源加载失败提示。

`npm run dev` 和 `npm run build` 会先执行 `scripts/prepare-ocr.mjs`，从锁定依赖复制 OCR 运行资源到 `public/ocr/`。该目录为生成目录，不提交到版本库。

相关项目：[Tesseract.js](https://github.com/naptha/tesseract.js)、[OpenCC-JS](https://github.com/nk2028/opencc-js)、[ChillRound](https://github.com/Warren2060/ChillRound)。字体许可见 `public/fonts/OFL-ChillRound.txt`。
