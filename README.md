# 血染钟楼 · 说书人工具

一个面向手机使用的中文 Blood on the Clocktower 主持辅助网站。它提供剧本管理、开局配板、魔典、夜间流程、提名计票、对局记录，以及基于 Supabase 的多人联机能力。

在线版本：[桌游.club/blood-on-the-clocktower](https://xn--hyvt5k.club/blood-on-the-clocktower/)

> 本项目是非官方辅助工具。角色能力提示不能替代正式规则；规则裁定和胜负判断始终由说书人负责。

## 主要功能

- 内置三套基础剧本，并支持搜索、编辑、复制和导入自制剧本。
- 支持 5–15 名普通玩家、旅行者、随机或固定座位发牌，以及真实身份与展示身份分离。
- 提供手机魔典、夜间任务、标记与笔记、计时、提名计票、处决和公开事件记录。
- 本机模式使用浏览器存储，适合单设备线下主持。
- 联机模式支持房间码、玩家申请与入座、私密身份和消息、换设备重绑及断线恢复。
- 支持完整存档、精简备份、公开记录、局面快照和赛后复盘。
- 可在浏览器中把 JPG、PNG 或 WebP 剧本图片识别为可编辑的剧本 JSON。

## 本地开发

需要 Node.js 22.12 或更高版本。

```bash
npm ci
npm run dev
```

开发服务器默认监听 `http://localhost:5173`。生产构建和完整检查：

```bash
npm run build
npm run check
```

联机功能还需配置 Supabase。没有 Supabase 时，本机主持和剧本工坊仍可使用。

## 文档

- [使用指南](docs/USER_GUIDE.md)：说书人和玩家的完整操作流程及功能边界。
- [部署指南](docs/DEPLOYMENT.md)：Supabase、GitHub Pages 和环境变量配置。
- [数据与权限设计](docs/ARCHITECTURE.md)：本机与联机模式、数据投影和权限边界。
- [界面与组件约定](docs/DESIGN.md)：视觉、响应式、可访问性和保密显示规则。
- [图片转剧本 JSON](docs/IMAGE-IMPORT.md)：OCR 使用方式和限制。
- [内容来源与许可](docs/CONTENT.md)：项目许可、第三方内容和素材边界。

## 项目结构

```text
src/                         React 前端
supabase/functions/          Edge Function 与共享游戏引擎
supabase/schema.sql          数据库结构、RLS 与事务函数
tests/                       核心逻辑与导入测试
public/art/                  网站使用的图片资源
.github/workflows/           Pages 与 Supabase 部署工作流
```

## 许可

项目自行创作的应用代码采用 [MIT License](LICENSE)。Blood on the Clocktower、角色名称、规则内容和商标的权利归原权利人所有；详见[内容来源与许可](docs/CONTENT.md)。
