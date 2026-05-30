# Personal Site Template

一个开箱即用的**个人主页全栈模板**。

- 前端：`Next.js` 负责页面、路由、国际化
- 后端：`Go API` 负责内容管理、登录、媒体上传、AI 对话
- 数据：内容默认走本地文件快照；管理员鉴权（用户、会话、登录失败、审计）落 Postgres，开发默认 in-memory 兜底

## 架构

```mermaid
flowchart LR
  User --> NextFrontend
  NextFrontend --> GoApi
  NextFrontend --> AdminProxy
  AdminProxy --> GoApi
  GoApi --> ContentStore
  GoApi --> MediaStore
  GoApi --> DeepSeek
```

- `app/`：Next.js 前端 + 极薄的 API 代理（只负责把请求转给 Go）
- `backend/`：Go 后端，含 `auth` / `content` / `media` / `ai` / `ratelimit`
- `lib/`：前端访问后端的工具层、共享 DTO、静态回退数据

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端 | Next.js 15 · React 18 · TypeScript 5 |
| UI | Tailwind CSS · Radix UI · Framer Motion · Lucide |
| 字体 | Inter (sans) · Fraunces (display) · JetBrains Mono · Ma Shan Zheng（中文姓名艺术体，仅用于首页 hero） |
| 国际化 | next-intl（中 / 英） |
| 后端 | Go 1.25 · 标准库 `net/http` |
| 内容存储 | 本地 `content.json` 原子写入（可平迁 Postgres） |
| 鉴权 | Postgres 持久化 + bcrypt + HttpOnly Strict cookie + CSRF double-submit + 失败锁定 + 审计日志 |
| 限流 | 按 IP 令牌桶 + 按邮箱/IP 慢路径锁定 |
| 媒体上传 | 预签发 URL + 路径穿越防御 + MIME / 大小限制 |
| AI | DeepSeek Chat API（Go 端代理，支持流式） |

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 Postgres（可选但推荐）

```bash
docker compose up -d
```

不带 `DATABASE_URL` 时，鉴权会退化为内存模式：进程重启会丢用户、会话、登录失败计数和审计——只适合本地试跑。

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`，至少填：

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

GO_API_URL=http://localhost:8081
GO_API_INTERNAL_URL=http://127.0.0.1:8081
BACKEND_ADDR=:8081
BACKEND_DATA_DIR=.backend-data
APP_ORIGIN=http://localhost:3000

# Postgres（管理员鉴权）
DATABASE_URL=postgres://hello:hello@127.0.0.1:5432/hello_gutsyang?sslmode=disable

ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD_HASH=
# 不填 hash 时可以临时用明文 bootstrap：
ADMIN_BOOTSTRAP_PASSWORD=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
# 可选模型：deepseek-v4-flash（快 & 便宜，默认）/ deepseek-v4-pro（质量更高）
DEEPSEEK_MODEL=deepseek-v4-flash
```

> 不填 `DEEPSEEK_API_KEY` 时，AI 会自动走演示模式。

### 4. 跑数据库迁移

```bash
cd backend
go run ./cmd/api migrate up
```

### 5. 生成管理员密码哈希（推荐）

```bash
cd backend
go run ./cmd/api hash 'your-strong-password'
```

把输出贴到 `ADMIN_BOOTSTRAP_PASSWORD_HASH`，并清空 `ADMIN_BOOTSTRAP_PASSWORD`。
首次启动时会把这条用户写入 Postgres，之后即可清空 env，依赖数据库即可。

### 6. 启动

```bash
npm run dev:backend   # Go API   → :8081
npm run dev:frontend  # Next.js  → :3000
```

打开：

- 前台：<http://localhost:3000>
- 后台：<http://localhost:3000/admin>
- 健康检查：<http://localhost:8081/healthz>

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | Next 前端开发服 |
| `npm run dev:backend` | 启动 Go API |
| `npm run build` / `npm run start` | 构建 / 启动生产前端 |
| `npm run lint` / `npm run typecheck` | 代码检查 |
| `npm run test:backend` | Go 单元测试（含端到端 httptest） |
| `npm run db:up` / `db:down` | docker compose 启停 Postgres |
| `npm run db:migrate` / `db:status` | 跑迁移 / 查看已应用版本 |
| `npm run admin:reset-password admin@example.com` | 离线重置管理员密码 |
| `npm run admin:set-email admin@example.com new@example.com` | 离线改邮箱 |

## 接口速查

**Public**：`/v1/public/home` `/profile` `/projects[/:slug]` `/experiences[/:slug]` `/honors` `/education` `/timeline`

**Admin**：`/v1/admin/login` `/logout` `/session` `/password` `/email` `/sessions` `/audit` `/profile` `/projects` `/experiences` `/honors` `/media/upload-url` · `POST /v1/admin/ai/translate`（中文 → 英文）

**访客 AI**：`POST /v1/ai/chat`（流式回答 + 落库）· `GET /v1/ai/sessions` · `GET /v1/ai/sessions/:id/messages` · `DELETE /v1/ai/sessions/:id`

> 登录 / AI 两处默认带 IP 限流；AI 会话列表/读取/删除走单独宽松桶（`RATE_LIMIT_AI_LIST_*`）。

## 管理员鉴权

- **持久化**：用户、会话、登录失败、审计日志全部落 Postgres（`backend/migrations/`）
- **会话**：HttpOnly + `SameSite=Strict` + 滑动续期；可在 `/admin/settings` 列出并踢出其他设备
- **CSRF**：登录时同时下发 csrf cookie，`/v1/admin/*` 的写操作必须附带 `X-CSRF-Token` 头部
- **失败锁定**：每 IP 或每邮箱在 15 分钟内累计 5 次失败 → 429 + `Retry-After`
- **审计**：登录、改密、改邮箱、踢会话、CMS 增删改写入 `admin_audit`，前端在 `/admin/audit` 可视化
- **运维**：忘记密码用 `go run ./cmd/api reset-password admin@example.com`，改邮箱用 `set-email`，重启即生效

## 后台只填中文，英文由 AI 兜底

四张管理表单（个人信息 / 项目 / 履历 / 荣誉）现在只暴露中文输入框。每张表单顶部都有「AI 一键生成英文」按钮：

- 浏览器调用 `POST /v1/admin/ai/translate`（admin session + CSRF + `RATE_LIMIT_ADMIN_AI_*` 限流）
- 后端把多个字段一次性丢给 DeepSeek（非流式 JSON），保持术语一致并减少往返
- 生成结果回填到隐藏的 `*_en` 字段；可展开「英文预览」肉眼检查
- 若管理员忘了点按钮，Server Action（`saveProfile / saveProject / saveExperience / saveHonor`）保存前会自动再调一次翻译兜底；DeepSeek 失败时退而求其次把中文复制到英文字段，保证保存永远成功

> 想要真正的双语，**必须**在生产环境填 `DEEPSEEK_API_KEY`。没填时翻译走 demo 模式，会输出 `[EN] 中文`，方便本地调试但不要上线。

## 默认安全与稳定性

- 管理员密码：bcrypt 存储，明文 bootstrap 启动即丢弃
- 访客 AI 会话：匿名 `CHAT_OWNER_COOKIE`（HttpOnly + SameSite=Lax + 长期有效）将聊天历史绑定到浏览器；`chat_sessions` / `chat_messages` 两表存对话，删 cookie 等于一键忘记我
- CORS：白名单匹配，不回显任意 Origin
- HTTP 超时：`ReadHeader=5s` / `Read=15s` / `Write=5min` / `Idle=2min`
- 媒体上传：路径穿越防御 + 大小上限 + MIME 白名单 + 过期 ticket 自动回收
- 错误响应：5xx 统一稳定 message，堆栈仅入日志
- Next → Go：默认 8s 超时；admin middleware 5s；chat 代理 60s

## 上线核对（必做）

- [ ] `APP_ORIGIN` 指向 https，反代或 LB 终止 TLS
- [ ] `COOKIE_SECURE=on`（或保持 `auto` 但确认 origin 是 https）
- [ ] `DATABASE_URL` 指向托管 Postgres，且执行过 `migrate up`
- [ ] `ADMIN_BOOTSTRAP_PASSWORD_HASH` 仅一次性使用：首次启动后从 secret store 删除
- [ ] `ADMIN_BOOTSTRAP_PASSWORD` 在生产环境**永远空着**
- [ ] 把 Postgres 的 `admin_users` / `admin_sessions` / `admin_audit` / `admin_login_attempts` / `chat_sessions` / `chat_messages` 纳入备份策略
- [ ] 验证：故意输错 5 次密码 → 收到 429 + `Retry-After`
- [ ] 验证：随便从浏览器 devtools 删掉 csrf cookie → POST 写接口收到 403
- [ ] `DEEPSEEK_API_KEY` 必填，否则后台保存的英文会是 `[EN] xxx`

## 走向生产的下一步（可选）

1. `content` 从文件迁到 Postgres（`backend/migrations/001_init.sql` 已就绪）
2. `cache` 与 `ratelimit` 从进程内迁到 Redis
3. `media` 从本地迁到 S3 / MinIO
4. 加结构化日志 + request id + 拆分 `/livez` `/readyz`
5. 接 webhooks / Slack 给 `login.failure` / `login.locked` 实时告警

## License

MIT
