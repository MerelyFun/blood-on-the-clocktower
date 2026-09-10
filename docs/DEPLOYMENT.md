# GitHub Pages + Supabase 部署

本次提供可部署代码与静态产物，没有绑定或改写你的现有项目。使用单独的 Supabase 项目最容易管理权限和后续数据。

## 1. 初始化 Supabase 数据库

在 Supabase 控制台选定项目，打开 SQL Editor，粘贴并运行 `supabase/schema.sql` 全文。

脚本通过一个事务创建 `bt_` 前缀的表、RLS 和命令函数。它是**首次安装脚本**，不是可重复执行的重置脚本：安装过后不要重复执行，也不要删除既有表来解决报错。

需要使用 CLI 迁移工作流时，可在尚未安装数据库结构前执行：

```bash
supabase --help
npm run db:migration
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

`db:migration` 调用 CLI 生成迁移文件名，再复制初始化 SQL。选择 SQL Editor 或 CLI 迁移其中一种方式，避免重复安装。后续结构变更应使用新迁移。源码交付环境未安装成功 Supabase CLI，因此没有伪造一个时间戳迁移文件。

## 2. 配置认证

Supabase 控制台 Auth：

- 启用 **Anonymous Sign-ins**，供玩家匿名加入。
- 说书人可使用 Email 登录链接；也可启用 GitHub Provider。
- Site URL 设置为最终网站地址，例如 `https://YOUR_NAME.github.io/clocktower/`。
- Redirect URLs 添加同一个完整地址，并在开发时添加 `http://localhost:5173/`。
- GitHub OAuth App 的回调地址填写 Supabase 控制台提供的 `https://PROJECT_REF.supabase.co/auth/v1/callback`，不要把它写成 Pages 地址。
- 如启用验证码保护，在 Supabase 中配置 Cloudflare Turnstile secret，在网站配置 `VITE_TURNSTILE_SITE_KEY`。匿名玩家和邮箱登录界面均提供验证码入口。

使用 PKCE 登录回调；游戏页面用 Hash 路由，不把 Auth 回调 hash 当作游戏路由。

玩家同一浏览器重新进入可继续使用原身份。清除站点数据、切换浏览器或账号后无法自动找回匿名凭据，须说书人在“邀请 / 入座”中勾选“替换该座位旧设备”重新绑定。

## 3. 部署 Edge Function

从 Supabase 官方说明安装 CLI，先执行其帮助，再登录和部署：

```bash
supabase --help
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ALLOWED_ORIGINS=https://YOUR_NAME.github.io,http://localhost:5173
supabase functions deploy game --project-ref YOUR_PROJECT_REF
```

注意：`ALLOWED_ORIGINS` 填**来源域名**，不带 `/clocktower/` 路径，不带末尾 `/`，多个来源用逗号分隔。自定义域名需要一并加入。前端开发端口或预览端口改变后，也要加入对应来源。

函数读取 Supabase 托管环境提供的 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。后者仅存在于服务端，绝不能填写到前端配置或 GitHub 的前端构建变量。

`supabase/config.toml` 已设置 `verify_jwt = false`，因为函数内部用 `auth.getUser` 验证真实用户，兼容当前 Auth 签名机制。它**不是免登录接口**。即便调用者伪造请求体中的用户或说书人角色，也不会被采信。

也可用已提供的 **Deploy Supabase game function** 工作流：

| GitHub 设置 | 名称 | 值 |
| --- | --- | --- |
| Repository secret | `SUPABASE_ACCESS_TOKEN` | 你的 Supabase 管理 Access Token，仅部署函数使用 |
| Repository variable | `SUPABASE_PROJECT_ID` | 项目的 ref，例如 20 位项目标识 |

数据库初始化与 `ALLOWED_ORIGINS` 仍需先完成。该工作流只在 Actions 中手动触发，不会随每次前端提交修改数据库。CLI setup action 固定版本；CLI 固定为本次检查过帮助的 2.117.0；工作流在部署前运行类型检查、核心测试和 Deno 函数检查。

## 4. 建立 GitHub 仓库

把 `clocktower` 目录中的内容放到仓库根目录，包含 `.github`、`supabase`、`src` 和 `package.json`；不要在仓库根目录再套一层 `clocktower/`。

在已创建且目标正确的空仓库中，可执行：

```bash
git init
git branch -M main
git add .
git commit -m "Build Clocktower storyteller companion"
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

`node_modules`、本机环境文件和 `dist` 已在 `.gitignore` 中；Actions 会从源码生成 `dist`。不要提交私密存档、身份表、服务密钥或个人 `.env`。

## 5. 配置 GitHub Pages

进入仓库 Settings → Secrets and variables → Actions → Variables：

| Repository variable | 必填 | 用途 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 联机必填 | Supabase 项目 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 联机必填 | Publishable key；也兼容旧版 anon key |
| `VITE_TURNSTILE_SITE_KEY` | 按配置 | 登录验证码的公开 site key |

这些是**公开前端配置**，会进入构建文件。不要使用 Supabase secret / service_role 密钥。

接着在 Settings → Pages → Build and deployment，将 Source 选择 **GitHub Actions**。进入 Actions，运行 **Deploy website to GitHub Pages**，或向 `main` 推送提交。

工作流通过 `configure-pages` 输出确定 Vite base 路径，同时适配项目站点、用户站点和自定义域名。Hash 路由让刷新 `#/cloud/ROOM_ID` 不依赖服务器重写。

Pages 发布前会运行类型检查和核心自动测试，再构建并发布。

## 6. 服务与权限行为

- 客户端按受众订阅 `bt_signals`；该表只含刷新信号。
- 身份、私信、公开状态由数据库分开存储，RLS 分开授权。
- 发牌、计票、处决等操作通过 game 函数进入服务端引擎，再通过版本检查事务写入。
- Realtime 正常时使用 60 秒兜底刷新，断开时恢复 10 秒轮询；轮询仅在页面可见时进行。
- “提交待确认”时可重试同一操作 ID，避免网络超时后重复发牌或扣票。
- 换设备时先撤销旧绑定，再授予新绑定。每次读取、提交都重新核对当前成员关系。

## 7. 维护和排障

| 表现 | 对应处理 |
| --- | --- |
| 只有本机模式能用 | 填写前端 Supabase URL / publishable key，再重新构建；或在当前浏览器设置页填写 |
| 新玩家无法匿名登录 | 检查 Anonymous Sign-ins、验证码配置、Auth 限流 |
| OAuth 或邮箱回调错误 | 核对 Site URL、Redirect URLs、GitHub Provider 的 Supabase 回调地址及尾部路径 |
| “此网站地址未获允许” | 把真实 Origin 加入 `ALLOWED_ORIGINS`，只填协议 + 域名 + 必要端口 |
| “无法连接联机服务” | 确认 game 函数已部署、SQL 已安装、项目正常运行及允许来源正确 |
| “局面已经更新” | 刷新，查看新的状态，再决定是否重新操作 |
| 待确认提交 | 使用“安全重试上次提交”；同一请求不会重复提交事务 |
| 座位已绑定 | 普通批准选择空座；换设备时明确勾选替换旧绑定 |
| 快照过大 / 单局内容过多 | 完整备份按实际 JSON 字节限制 3.9 MB；超限时可导出精简备份（去除历史快照，保留当前局面与秘密记录）。单局至多 500 条私信 |
| 30 个云端房间上限 | 先导出旧房间，项目管理员按 room ID 删除 `bt_rooms` 对应行；关联数据级联删除，不是玩家端操作 |

源代码没有自动清理生产数据的任务。完整存档只由说书人导出。数据库备份、数据保留与域名维护由项目拥有者管理。

官方参考：

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/guides/database/postgres/row-level-security
