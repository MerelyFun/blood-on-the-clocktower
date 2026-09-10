# 桌游.club 游戏入口

入口页位于 `public/hub/index.html`，随 GitHub Pages 一同发布：

https://merelyfun.github.io/blood-on-the-clocktower/hub/

两个按钮分别进入狼人真言与血染钟楼网站，使用 `target="_top"`，从旧的域名框架转发中点击时也会离开框架。

2026-09-11 检查：`桌游.club`（`xn--hyvt5k.club`）的 NS 为 Spaceship，HTTPS 根页面使用 frameset 嵌入狼人真言；它尚未切换到选择页。

域名所有者操作：登录 Spaceship → Domain list → 桌游.club → URL redirect，将目标改为上述入口地址。建议选择 302 普通转发并保存；地址栏会显示实际 GitHub Pages 网址。无需更改两个游戏的仓库或 Supabase 配置。

如果希望入口页始终使用中文域名，需要另行配置真正的自定义域名绑定与 DNS，而不是隐藏框架转发。

官方说明：https://www.spaceship.com/blog/domain-updates/
