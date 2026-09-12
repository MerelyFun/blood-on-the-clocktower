# 部署指南

本地开发默认使用电脑上的 SQLite，无需配置 Supabase。生产前端可部署到 GitHub Pages，云端联机使用可选的 Supabase Auth、Postgres、Realtime 和 Edge Functions。以下云端配置只在准备云端联机时需要；完成本机验证不代表获得发布授权。

玩家笔记升级：本机 SQLite 启动时自动创建 `notebooks` 表，旧 `notes` 表继续保留。云端升级时，需先应用 `supabase/migrations/20260912162912_player_notebooks.sql` 并更新 `game` Edge Function，再发布前端，以提供笔记 RPC 和稳定参与者公开标识。本次 2026-09-12 版本发布已应用该迁移并更新云端函数。仅执行本地预览或构建不会应用云端迁移。

## 1. 本地验证

需要 Node.js 22.17 或更高版本，使用 Node 内置 SQLite。当前版本可能输出 experimental 警告；不需要另外安装数据库或 Docker。

```bash
npm ci
npm run dev
```

打开 `http://localhost:5174/`。此命令同时运行监听 `0.0.0.0:5174` 的 Vite 前端和监听 `127.0.0.1:5175` 的本机 API，前端通过同源 `/api/local` 代理访问 API。手机只需连接同一 Wi-Fi 并访问 `http://电脑的局域网IP:5174/`；若无法连接，检查电脑防火墙是否允许该本地开发服务。

建议说书人和玩家统一使用局域网地址：`localhost` 与局域网 IP 是不同浏览器来源，各自保存不同设备凭据。不能把含 `localhost` 的邀请链接发给另一台手机。

首页默认“本机数据库”支持多人加入；“仅此浏览器”是原有 IndexedDB 单设备模式。SQLite 数据库默认位于 `.local-data/clocktower.sqlite`，房间、设备会话、剧本和私人笔记会在重启后保留；不要提交该目录。删除数据库前先通过应用导出需要的存档和剧本，另行保存重要私人笔记。

启动参数可通过终端环境变量覆盖：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `CLOCKTOWER_PORT` | `5174` | 前端访问端口 |
| `CLOCKTOWER_API_PORT` | `5175` | 仅本机监听的 API 端口 |
| `LOCAL_DATABASE_PATH` | `.local-data/clocktower.sqlite` | SQLite 文件路径 |
| `VITE_BACKEND` | 开发为 `local`，生产构建为 `supabase` | 显式选择数据后端 |

例如 PowerShell 中使用 `$env:CLOCKTOWER_PORT="5180"` 后执行 `npm run dev`。本机模式不需要 Supabase key 或执行任何 Supabase migration。若需在开发中测试云端，设置 `VITE_BACKEND=supabase` 并提供下文公开配置，再重新启动。

`npm run build` 默认构建云端版本，除非显式设置了 `VITE_BACKEND=local`；构建前留意 `.env.local` 和终端变量。`npm start` 仅提供 `dist` 静态文件，不启动本机 API，不能代替 `npm run dev` 作为完整本机数据库服务。不要将本机后端构建发布到 GitHub Pages。

验证命令：

```bash
npm run check
npm run typecheck:edge
```

`npm run check` 依次执行前端类型检查、自动测试和生产构建。`npm run typecheck:edge` 使用锁定的 Deno 版本检查云端函数，首次运行会下载相应工具。

## 2. 初始化 Supabase

建议为网站使用独立 Supabase 项目。在 SQL Editor 中完整执行一次 `supabase/schema.sql`。脚本会创建 `bt_` 前缀的业务表、私有辅助 schema、RLS 策略、事务 RPC 和 Realtime 发布配置。

该文件是首次安装脚本，不是重置脚本。已安装的项目应通过新的迁移文件升级，不要重复执行初始化脚本或删除生产表来消除报错。

也可以在首次安装前使用迁移工作流：

```bash
npm run db:migration
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

SQL Editor 和 CLI 迁移二选一，避免安装两次。

## 3. 配置认证

在 Supabase Authentication 中：

- 启用 Anonymous Sign-ins，供玩家无账号申请加入。
- 为说书人启用 Email 登录；GitHub Provider 可按需启用。
- 将 Site URL 设置为网站的完整地址。
- 将正式地址和本地开发地址加入 Redirect URLs。
- 如启用 Cloudflare Turnstile，在 Supabase 保存 secret key，并在前端配置公开 site key。

GitHub OAuth App 的回调地址应使用 Supabase 控制台给出的 `/auth/v1/callback` 地址，而不是 GitHub Pages 地址。

## 4. 部署 Edge Function

安装并登录 Supabase CLI 后，在仓库根目录执行：

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ALLOWED_ORIGINS=https://YOUR_NAME.github.io,http://localhost:5174
supabase functions deploy game --project-ref YOUR_PROJECT_REF --use-api
```

`ALLOWED_ORIGINS` 填写 Origin，即协议、域名和可选端口；不要包含仓库路径或末尾斜杠。多个来源用逗号分隔。

`supabase/config.toml` 将 `verify_jwt` 设为 `false`，因为 `game` 函数内部使用 `auth.getUser` 验证用户并重新检查成员权限。该配置不表示接口允许匿名绕过认证。

`SUPABASE_SERVICE_ROLE_KEY` 只允许存在于 Supabase 托管环境，绝不能写入前端环境变量、仓库或 GitHub Repository variables。

## 5. 配置前端环境变量

仅需使用云端后端时，复制 `.env.example` 为 `.env.local`，填写公开配置；开发访问云端还需显式指定后端：

```dotenv
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_BASE_PATH=/YOUR_REPOSITORY/
VITE_TURNSTILE_SITE_KEY=
```

本地开发通常可将 `VITE_BASE_PATH` 留空。Publishable key 会进入浏览器构建产物，不能替换成 secret 或 service role key。

## 6. 发布到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`。在 GitHub 仓库中完成以下设置：

1. Settings → Secrets and variables → Actions → Variables，添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`；按需添加 `VITE_TURNSTILE_SITE_KEY`。
2. Settings → Pages → Build and deployment，将 Source 设为 GitHub Actions。
3. 推送到 `main`，或手动运行“Deploy website to GitHub Pages”。

工作流会自动获取 Pages base path，运行类型检查和测试，构建后发布 `dist`。应用使用 Hash 路由，因此房间链接不依赖服务器重写。

部署 Supabase 函数也可使用 `.github/workflows/supabase.yml`。该工作流需要：

| GitHub 设置 | 名称 | 用途 |
| --- | --- | --- |
| Repository secret | `SUPABASE_ACCESS_TOKEN` | 部署时使用的管理令牌 |
| Repository variable | `SUPABASE_PROJECT_ID` | Supabase project ref |

数据库迁移、认证设置和 `ALLOWED_ORIGINS` 仍需单独维护。

## 7. 发布后检查

至少验证以下流程：

- 说书人持久账号可登录并创建联机房间；
- 匿名玩家可申请加入、获批入座并查看自己的展示身份；
- 两个不同玩家无法读取彼此的身份、私信或私人笔记；
- 发牌、私信、提名计票和阶段切换能在不同设备间刷新；
- 更换设备后旧绑定失效；
- 网络结果不确定时，安全重试不会重复提交同一操作；
- 页面刷新、短暂断网和重新打开浏览器后可恢复到正确房间。

## 8. 常见问题

| 表现 | 检查项 |
| --- | --- |
| 本机数据库无法连接 | 使用 `npm run dev`，检查 API 启动日志、端口占用及 Node 版本 |
| 手机无法打开本机预览 | 使用电脑当前局域网 IP；确认同一 Wi-Fi、服务运行及防火墙设置 |
| 本地身份或房间似乎丢失 | 核对访问来源、浏览器和数据库路径；切换 IP、端口或清理站点数据会改变设备身份 |
| 云端模式不可用 | 确认 `VITE_BACKEND=supabase`、前端 URL 和 publishable key，并重启或重新构建 |
| “页面暂时无法继续” | 展开错误信息并检查浏览器控制台；这是通用错误页，不能仅凭页面文案认定 Supabase 故障 |
| 玩家无法匿名加入 | 检查 Anonymous Sign-ins、验证码配置和 Auth 限流 |
| 登录回调失败 | 检查 Site URL、Redirect URLs 和 OAuth 回调地址 |
| 网站地址未获允许 | 将实际 Origin 加入 `ALLOWED_ORIGINS` |
| 无法连接联机服务 | 检查数据库初始化、`game` 函数部署和项目状态 |
| 提示局面已经更新 | 刷新后依据新状态重新操作 |
| 提交结果待确认 | 使用“安全重试上次提交”，不要重新创建同类操作 |
| 座位已绑定 | 为新玩家选择空座；换设备时明确替换旧绑定 |

上游参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Supabase Edge Functions 部署](https://supabase.com/docs/guides/functions/deploy)、[匿名登录](https://supabase.com/docs/guides/auth/auth-anonymous)、[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。
