# API 说明

接口由 `server/index.ts` 提供，推荐网页与 API 同源部署。除健康检查和账号登录/注册/找回外，业务接口要求 `npc_session` Cookie。写请求必须携带允许的 `Origin`；JSON 请求使用 `Content-Type: application/json`。错误返回 `{ "error": "说明" }`，状态码包括 400（参数）、401（登录）、403（权限）、404、409（状态冲突）和 429（登录限流）。

时间统一使用 Unix 毫秒整数，页面负责本地输入与北京时间展示。完整响应类型见 `lib/community-types.ts`，参数校验以 `server/` 实现为准。

## 账号

| 方法与路径 | JSON 参数 | 说明 |
| --- | --- | --- |
| GET `/api/health` | 无 | 检查 MySQL 连接，返回 `ok`、`database` |
| GET `/api/auth/me` | 无 | 当前账号、昵称、城市 |
| POST `/api/auth/register` | `username, password, name, city` | 注册并设置会话，返回一次性 `recoveryCode` |
| POST `/api/auth/login` | `username, password` | 设置会话 |
| POST `/api/auth/logout` | `{}` | 撤销当前会话 |
| POST `/api/auth/recover` | `username, password, recoveryCode` | 重设密码并轮换恢复码，撤销旧会话，需重新登录 |
| POST `/api/auth/password` | `currentPassword, password` | 登录后改密，撤销旧会话并设置新会话 |

账号为 4–32 位字母、数字或下划线，服务端转为小写；新密码为 10–128 位。昵称和城市为 1–24 字。恢复码和会话都是敏感数据，不要记录在日志里。

## 社区任务

GET `/api/community` 返回 `CommunityState`：当前用户、任务列表、经验值、统计和服务器时间。GET `/api/community/:id` 返回 `TaskDetail`：任务、允许查看的参与记录、动态和附件。列表当前最多 500 条；草稿只对发布者可见。

POST `/api/community` 创建任务，字段如下：

| 字段 | 约束 |
| --- | --- |
| `action` | `draft` 或 `publish` |
| `title` | 4–60 字 |
| `description` | 10–2000 字 |
| `requirements` | 5–1000 字 |
| `category` | 城市探索、生活体验、运动户外、读书交流、公益行动之一 |
| `city` / `place` | 1–24 字 / 2–100 字 |
| `deadline` | Unix 毫秒；创建时至少一分钟后，最多 90 天后 |
| `capacity` | 1–100 的整数 |

草稿也需要完整有效的字段。奖励由服务器固定为 20 XP，不能由客户端指定。POST `/api/community/:id` 根据 `action` 执行：

| action | 附加字段 | 操作者与含义 |
| --- | --- | --- |
| `edit` | 上表所有任务字段 | 发布者编辑草稿 |
| `publish` | 无 | 发布者发布草稿 |
| `join` | 无 | 非发布者报名；服务端锁定名额 |
| `withdraw` | 无 | 符合状态要求的参与者退出并释放名额 |
| `draft_submission` | `note`，最多 2000 字 | 保存本人私有记录 |
| `submit` | `note`，10–2000 字；`confirmed: true` | 截止前提交验收 |
| `review` | `participation` UUID、`decision`、`feedback` | 发布者验收；decision 为 approved/rejected，反馈最多 500 字，退回至少 5 字 |
| `close` | 无 | 发布者停止招募，保留已有参与者提交资格 |
| `cancel` | `reason`，5–300 字 | 发布者取消；有待验收记录时拒绝 |

任务和参与状态限制见 [产品说明](PRODUCT.md)。验收、积分流水和状态变化处于同一数据库事务中；重复通过不会重复奖励。每人有独立参与记录，完成任务后仍可创建新任务。

## 附件、探索与地图

- POST `/api/media`：`multipart/form-data`，字段 `run` 为个人探索运行 ID 或社区参与 ID，`file` 为文件。每个参与记录最多 6 个附件，单个最多 5 MB。支持 JPEG/PNG/WebP 图片及 OGG/MP4/WebM 音频，并检查文件头。
- GET `/api/media?id=附件ID`：下载经权限校验的附件。社区未提交记录及附件只对参与者可见；提交后发布者可查看，其他参与者仍不可见。
- GET/POST `/api/game`：保留的个人探索、活动、收藏和真人 NPC 邀请接口。动作与字段见 `server/exploration.ts`、`lib/types.ts` 及 `tests/mysql.integration.ts`。
- GET `/api/map-config`：返回高德浏览器 key 和是否配置完成；安全码只留在服务器。`/_AMapService/` 为限定路径的高德服务代理，未配置时明确返回错误。

独立部署不需要 `API_PROXY_SECRET`。仅在可选 Sites 网关模式下由网关加入此头部，不能把它写到浏览器代码中。
