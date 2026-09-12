# 独立部署（MySQL 版）

这套版本运行在 Node.js 22 + MySQL 8，不依赖 ChatGPT 登录、D1 或 R2。可以部署到国内 Linux 云服务器并连接已有 MySQL。高德地图是唯一预留的地图三方服务。

## 本机运行

1. `npm ci`
2. 从 `.env.server.example` 复制 `.env.server`，生成独立随机数据库密码，填入对应的 `MYSQL_URL`（URL 中特殊字符需编码）。已有本机配置时先核对，不要覆盖。
3. `docker compose --env-file .env.server up -d mysql`
4. MySQL healthy 后执行 `npm run db:migrate`
5. 两个终端分别运行 `npm run api:dev` 和 `npm run dev:app`
6. 打开 http://127.0.0.1:5173，自行注册。数据库在命名卷 `life-npc_mysql_data`，重启服务不丢数据。`docker compose down` 保留卷，**不要使用 `down -v`**。

## 国内服务器

1. 配置一个专用 MySQL 8 数据库和应用账号，不使用 root 运行业务；字符集 utf8mb4。服务器已有数据库时无需新建容器。连接云数据库时启用 `MYSQL_SSL=true` 并保持证书验证。
2. 在 `.env.server` 设置真实 `MYSQL_URL`、`APP_ORIGINS=https://你的域名`、`COOKIE_SECURE=true`、高德两项配置。生产配置的数据库地址应可从应用容器访问，不能填写容器自身的 127.0.0.1。
3. `docker compose -f deploy/compose.production.yaml build api`
4. `docker compose -f deploy/compose.production.yaml run --rm api node --import tsx server/migrate.ts`
5. `docker compose -f deploy/compose.production.yaml up -d api`
6. 配置同源 HTTPS 反向代理，参考 `deploy/nginx.conf.example`；仅对外开放 HTTPS，数据库和 8788 端口保持内网/回环绑定。
7. 检查 `/api/health`、实际注册登录、两用户报名和验收、附件访问、地图和移动设备定位/录音。

应用容器自带构建后的网页，也可以直接运行 `npm run build:app` 后 `npm run start:app`。独立版前端不包含服务器密码，不依赖 Sites 的身份请求头。

## 数据与备份

- `server/migrations/*.sql` 是 MySQL 唯一正式迁移来源。迁移工具通过数据库锁串行执行并验证历史文件校验和；MySQL DDL 不支持整个文件回滚，失败时请先核对已执行语句，再修复，不要改已应用文件。
- 账号密码使用带盐 scrypt，不保存明文。Session 仅在 HttpOnly Cookie 中，数据库只保存 token 哈希。恢复码只显示一次，数据库仅保存哈希，使用后立即轮换；改密和找回会退出其他设备。
- 附件内容现在保存在 MySQL `media_objects` 的 MEDIUMBLOB，单文件 5 MB、每次参与最多 6 个。好处是业务与附件可一同备份；容量增长后可替换 `server/core.ts` 的存储仓库为国内对象存储，元数据仍在 MySQL。当前没有声称已接入 OSS/COS。
- 对生产数据库做定期加密备份，使用 `mysqldump --single-transaction --hex-blob` 并在单独数据库中演练恢复。数据库密码使用权限 600 的客户端配置文件，不写在命令行或日志。
- 旧版 D1/R2 的历史数据没有删除、没有自动迁移。旧版以 ChatGPT Site 身份标识用户，新版以自主账号标识用户，迁移真实用户记录前必须建立经过验证的账号对应关系，不能仅按昵称匹配。旧 `.wrangler/state` 是隔离的本机测试数据。

## Sites 可选预览

仓库保留 `.openai/hosting.json` 和原构建流程，Sites 可以作为 UI 网关。`API_BASE_URL` 指向已部署的 HTTPS Node 服务，`API_PROXY_SECRET` 在两端一致，后端 `APP_ORIGINS` 需包含 Sites 来源。所有业务数据仍由 Node 服务写入 MySQL，网关不回退到 D1。

若独立站和 Sites 同时使用，不应对所有请求强制同一网关 secret；可以为 Sites 设置独立网关入口。本次未配置国内线上服务器，因此不把缺少业务连接的版本覆盖到旧线上预览。

## 当前界限

这是响应式 WebApp，可添加到手机主屏；尚未制作原生 Android/iOS 包。注册为账号密码方式，不含短信或邮箱验证码。恢复码用于找回，必须妥善保存。公开任务可由发布者验收，尚未实现平台仲裁、内容审核后台、消息推送。正式对外运营前需要按产品运营规模补充这些流程；当前完成的是用户提出的注册、任务多人闭环和 MySQL 架构。
