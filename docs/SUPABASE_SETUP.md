# Supabase 配置清单

**2026-09-10 当前状态：项目 `pyulxbobnxyudrlisqyv` 已配置完成，无需重复执行下面的初始化步骤。** 已创建 9 张业务表并启用 RLS，部署 `game` 函数，开启匿名登录，配置本机登录回跳与允许来源，并写入本机 `.env.local`、重新构建前端。

真实云端创建与重试、申请审批、配牌、私信隔离、跨账号读取与命令权限、领牌确认重试、换设备绑定均已验证；电脑与手机宽度的两个独立浏览器会话通过，临时房间及账号已清理。尚未验证个人邮箱登录、真实手机和长时间断线重连，前端尚未公开发布。安全顾问提示匿名账号适用 authenticated 策略，这是本项目匿名玩家模式的预期配置；已另行验证座位与房间权限隔离。

现在打开本机网站的账号设置，使用邮箱登录链接登录后即可创建联机房间。默认邮件服务仅允许项目团队成员邮箱；GitHub 登录仍需另行配置。以下保留为新项目安装和后续部署参考。

## 1. 准备项目和公开参数

创建一个用于本网站的 Supabase 项目，等状态可用。在项目 Connect / API Keys 中取得：

| 参数 | 示例 | 用途 |
| --- | --- | --- |
| Project URL | `https://项目标识.supabase.co` | 网站连接地址 |
| Publishable key | `sb_publishable_...` | 网站公开配置 |
| Project ref | 项目 URL 中的项目标识 | 部署 game 函数 |

可以把这三项提供给 Codex 完成网站接入。不要提供数据库密码、`service_role`、`sb_secret_...` 或管理 Access Token；它们不属于网站公开配置。[官方 API key 说明](https://supabase.com/docs/guides/getting-started/api-keys)

## 2. 初始化数据库

在项目 **SQL Editor** 新建查询，复制本仓库 `supabase/schema.sql` 全文执行一次。它创建业务表、权限、事务函数和 Realtime 发布配置。已经执行过则不要重复执行或删表重来；记录具体报错后检查。

成功后可运行以下只读检查，应有 9 张业务表，且 `rls_enabled` 均为 true：

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'bt_%'
order by c.relname;
```

这只是安装检查，不能替代跨账号权限验收。

## 3. 配置登录

在 **Authentication** 的登录方式设置中启用 **Anonymous Sign-ins**，供玩家申请入座。主持人使用 Email 登录链接，GitHub 登录可选。[匿名登录文档](https://supabase.com/docs/guides/auth/auth-anonymous)

在 **URL Configuration** 中设置：

| 设置 | 目前本机联调值 |
| --- | --- |
| Site URL | `http://127.0.0.1:5173/` |
| Redirect URLs | 添加 `http://127.0.0.1:5173/` 和 `http://localhost:5173/` |

上线后将 Site URL 改为正式网站完整地址，并将它加入 Redirect URLs；GitHub Pages 项目站点需包含仓库路径和末尾 `/`。[回调地址文档](https://supabase.com/docs/guides/auth/redirect-urls)

默认邮件服务只给项目团队成员地址发送测试邮件，且限流较严。初次测试可用你 Supabase 团队的邮箱；让其他说书人使用邮件登录前需要配置自定义 SMTP，或启用 GitHub 登录。[邮件配置文档](https://supabase.com/docs/guides/auth/auth-smtp)

如已启用 Turnstile，在 Supabase 填 secret key，在网站填公开 site key；二者不可混用。

## 4. 部署 game 函数

Windows PowerShell 中进入本项目，运行下面命令。将 `YOUR_PROJECT_REF` 替换为你的项目标识。CLI 2.117.0 的命令帮助已核对；部署本身尚未执行。

```powershell
Set-Location -LiteralPath 'E:\Code\Blood On The Clocktower'
npx.cmd --yes supabase@2.117.0 login
npx.cmd --yes supabase@2.117.0 secrets set 'ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173' --project-ref YOUR_PROJECT_REF
npx.cmd --yes supabase@2.117.0 functions deploy game --project-ref YOUR_PROJECT_REF --use-api
```

登录时自行在浏览器完成授权；使用 `--use-api` 无需本机 Docker。必须从仓库根目录部署，以带上 `_shared` 模块和 `supabase/config.toml`。仓库配置为 `verify_jwt=false`，函数内部仍用 `auth.getUser` 验证用户。

`ALLOWED_ORIGINS` 填协议、域名和端口，不填路径或末尾 `/`。正式发布时加入正式域名，保留仍需使用的开发来源。Supabase 自动提供的服务端环境变量无需填到网页。[函数部署文档](https://supabase.com/docs/guides/functions/deploy)

## 5. 接入网站并继续验收

完成后把 **Project URL、Publishable key、Project ref** 和“SQL / 匿名登录 / game 部署是否完成”告诉 Codex。当前浏览器也可在网站设置页填写 URL 和公开 key。

正式发布使用以下构建变量，不能只依赖主持人浏览器的设置：

```dotenv
VITE_SUPABASE_URL=https://项目标识.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

接入后继续验证主持人登录、玩家申请审批、不同账号身份隔离、固定发牌及刷新、换设备撤销旧绑定、断线恢复、超时重试和多人计票。这些云端验证尚未完成。
