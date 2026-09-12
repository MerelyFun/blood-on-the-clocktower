# 部署指南

前端是 Vite 静态站点，可部署到 GitHub Pages。联机房间依赖 Supabase Auth、Postgres、Realtime 和 Edge Functions；仅使用本机主持时可以跳过 Supabase。

## 1. 本地验证

需要 Node.js 22.12 或更高版本。

```bash
npm ci
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
supabase secrets set ALLOWED_ORIGINS=https://YOUR_NAME.github.io,http://localhost:5173
supabase functions deploy game --project-ref YOUR_PROJECT_REF --use-api
```

`ALLOWED_ORIGINS` 填写 Origin，即协议、域名和可选端口；不要包含仓库路径或末尾斜杠。多个来源用逗号分隔。

`supabase/config.toml` 将 `verify_jwt` 设为 `false`，因为 `game` 函数内部使用 `auth.getUser` 验证用户并重新检查成员权限。该配置不表示接口允许匿名绕过认证。

`SUPABASE_SERVICE_ROLE_KEY` 只允许存在于 Supabase 托管环境，绝不能写入前端环境变量、仓库或 GitHub Repository variables。

## 5. 配置前端环境变量

复制 `.env.example` 为 `.env.local`，填写公开配置：

```dotenv
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
| 只能使用本机模式 | 检查前端 URL 和 publishable key，并重新构建 |
| 玩家无法匿名加入 | 检查 Anonymous Sign-ins、验证码配置和 Auth 限流 |
| 登录回调失败 | 检查 Site URL、Redirect URLs 和 OAuth 回调地址 |
| 网站地址未获允许 | 将实际 Origin 加入 `ALLOWED_ORIGINS` |
| 无法连接联机服务 | 检查数据库初始化、`game` 函数部署和项目状态 |
| 提示局面已经更新 | 刷新后依据新状态重新操作 |
| 提交结果待确认 | 使用“安全重试上次提交”，不要重新创建同类操作 |
| 座位已绑定 | 为新玩家选择空座；换设备时明确替换旧绑定 |

上游参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Supabase Edge Functions 部署](https://supabase.com/docs/guides/functions/deploy)、[匿名登录](https://supabase.com/docs/guides/auth/auth-anonymous)、[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。
