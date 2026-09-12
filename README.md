# 血染钟楼 · 说书人工具

一个面向手机使用的中文 Blood on the Clocktower 主持辅助网站。它提供剧本管理、开局配板、魔典、夜间流程、提名计票、对局记录，以及本机 SQLite 和可选 Supabase 的多人联机能力。

在线版本：[桌游.club/blood-on-the-clocktower](https://xn--hyvt5k.club/blood-on-the-clocktower/)

> 本项目是非官方辅助工具。角色能力提示不能替代正式规则；规则裁定和胜负判断始终由说书人负责。

## 主要功能

- 内置三套基础剧本，并支持搜索、编辑、复制和导入自制剧本。
- 支持 5–15 名普通玩家、旅行者、随机或固定座位发牌，以及真实身份与展示身份分离。
- 提供手机魔典、夜间任务、标记与笔记、计时、提名计票、处决和公开事件记录。
- 本机数据库模式将数据保存在运行服务的电脑上，支持同一 Wi-Fi 内多台手机加入。
- “仅此浏览器”使用 IndexedDB，适合单设备线下主持。
- 联机模式支持房间码、玩家申请与入座、私密身份和消息、换设备重绑及断线恢复。
- 独立玩家笔记支持桌面显示主角色与额外状态，玩家信息和整局笔记按天分组；可关联房间自动同步公开信息，输入自动保存。
- 支持完整存档、精简备份、公开记录、局面快照和赛后复盘。
- 可在浏览器中把 JPG、PNG 或 WebP 剧本图片识别为可编辑的剧本 JSON。

## 本地开发与测试

需要 Node.js 22.17 或更高版本（使用内置 SQLite；启动时的 experimental 提示属于 Node 功能状态提示）。

```bash
npm ci
npm run dev
```

默认启动前端 `http://localhost:5174/` 和本机 SQLite API，无需 Supabase 账号、密钥或数据库迁移。首页选择“本机数据库”即可创建多人房间。手机连接同一 Wi-Fi 后，打开 `http://电脑的局域网IP:5174/`；建议说书人也使用这个地址创建房间，再分享邀请链接。

数据保存在 `.local-data/clocktower.sqlite`，重启服务后仍保留；该目录不进入 Git。剧本与玩家私人笔记也保存在本机数据库。清理数据前请先导出需要保留的存档和剧本。端口、数据库路径及云端切换见[部署指南](docs/DEPLOYMENT.md)。

生产构建和完整检查：

```bash
npm run build
npm run check
```

开发默认使用本机数据库，即使已有 Supabase 配置也不会自动连接云端；仅在显式设置 `VITE_BACKEND=supabase` 后切换。生产构建默认使用 Supabase 配置；`npm start` 只提供静态文件，不启动本机 API。不要将 `VITE_BACKEND=local` 的构建部署到 Pages。

本地人工测试统一运行 `npm run dev`，走本机 SQLite；不要单独启动 Vite、`npm run preview` 或 `npm start` 代替完整测试服务。修改后先给出本机和局域网预览地址，未经明确要求不发布。

## 文档

- [更新日志](CHANGELOG.md)：按自然日汇总已经提交的主要变化。
- [使用指南](docs/USER_GUIDE.md)：说书人和玩家的完整操作流程及功能边界。
- [部署指南](docs/DEPLOYMENT.md)：本机数据库启动、环境变量，以及可选 Supabase / GitHub Pages 配置。
- [数据与权限设计](docs/ARCHITECTURE.md)：本机与联机模式、数据投影和权限边界。
- [界面与组件约定](docs/DESIGN.md)：视觉、响应式、可访问性和保密显示规则。
- [图片转剧本 JSON](docs/IMAGE-IMPORT.md)：OCR 使用方式和限制。
- [内容来源与许可](docs/CONTENT.md)：项目许可、第三方内容和素材边界。

## 项目结构

```text
src/                         React 前端
scripts/local-server.mjs      本机数据库 HTTP API
scripts/local-store.ts        SQLite 存储与权限校验
.local-data/                 本地运行数据（不提交）
supabase/functions/          Edge Function 与共享游戏引擎
supabase/schema.sql          数据库结构、RLS 与事务函数
tests/                       核心逻辑与导入测试
public/art/                  网站使用的图片资源
.github/workflows/           Pages 与 Supabase 部署工作流
```

## 许可

项目自行创作的应用代码采用 [MIT License](LICENSE)。Blood on the Clocktower、角色名称、规则内容和商标的权利归原权利人所有；详见[内容来源与许可](docs/CONTENT.md)。
