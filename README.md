<div align="center">

# hello-gutsyang

**廖晨扬 / gutsyang (Tony) 的个人主页 · Personal Site**

一个支持中英双语、内置 AI 聊天和 CMS 后台的 Next.js 14 个人作品集站点。  
A bilingual personal portfolio built on Next.js 14, with a built-in AI chat and admin CMS.

<br />

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Radix UI](https://img.shields.io/badge/Radix_UI-1-161618?style=for-the-badge&logo=radixui&logoColor=white)](https://www.radix-ui.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-11-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Supabase](https://img.shields.io/badge/Supabase-2-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![next-intl](https://img.shields.io/badge/next--intl-3-FF6B6B?style=for-the-badge)](https://next-intl-docs.vercel.app/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=for-the-badge)](https://api.deepseek.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## 🌏 中文说明

### 项目简介

`hello-gutsyang` 是一个为「单人作者 + 多场景展示」设计的现代个人主页：

- **前台**：基于 Bento Grid 的首页 + 经历、项目、荣誉详情页，支持中英双语切换
- **后台**：`/admin` 内置轻量 CMS，可在线管理 profile / experiences / honors / projects，无需直接改数据库
- **AI 聊天**：`/chat` 路由对接 DeepSeek，让访客可以"问我自己" —— 通过 `lib/ai/system-prompt.ts` 注入身份上下文
- **简历导出**：`/api/resume.pdf` 用 `@react-pdf/renderer` 即时生成 PDF 简历

### 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Next.js 14（App Router · Server Components · Server Actions） |
| 语言 | TypeScript 5 |
| UI | Tailwind CSS · Radix UI · Framer Motion · Lucide Icons |
| 国际化 | next-intl（`zh` 默认，`en` 备选，路径前缀策略） |
| 数据 / 鉴权 | Supabase（PostgreSQL + Auth + Storage，通过 `@supabase/ssr`） |
| AI | DeepSeek Chat API（通过 `ai` SDK 流式输出） |
| PDF | @react-pdf/renderer |
| 部署 | Vercel（推荐） |

### 本地启动

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量模板并填入真实值
cp .env.example .env

# 3. 启动开发服务器
npm run dev
# 访问 http://localhost:3000 （会自动重定向到 /zh）
```

需要在 `.env` 中至少配置：

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` —— Supabase 项目
- `SUPABASE_SERVICE_ROLE_KEY` —— 仅服务器端使用，**切勿暴露到客户端**
- `ADMIN_EMAIL_ALLOWLIST` —— 允许登录后台的邮箱（逗号分隔）
- `DEEPSEEK_API_KEY` —— 启用 AI 聊天所需

### 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（含热更新） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动构建产物 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |

### 项目结构

```
hello-gutsyang/
├── app/
│   ├── [locale]/          # 双语前台（zh / en）
│   ├── admin/             # CMS 后台 + 登录页（中间件鉴权）
│   ├── api/
│   │   ├── chat/          # DeepSeek 聊天流式接口
│   │   └── resume.pdf/    # PDF 简历导出
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── bento/             # 首页 Bento Grid 卡片
│   ├── chat/              # 聊天室 UI
│   ├── admin/             # 后台表单组件
│   └── ui/                # 通用 UI 原子组件
├── lib/
│   ├── ai/                # AI 系统提示词
│   ├── supabase/          # Supabase client / server / types
│   ├── content.ts         # 内容读取层
│   └── profile.ts         # Profile 读取层
├── messages/
│   ├── zh.json            # 中文文案
│   └── en.json            # 英文文案
├── supabase/
│   ├── migrations/        # SQL 迁移
│   └── seed.sql           # 种子数据
├── i18n.ts                # next-intl 配置
├── middleware.ts          # i18n + 后台鉴权
└── next.config.mjs
```

### 分支策略

- `main` —— 受保护的发布分支，对应生产环境
- `develop` —— 默认开发分支，所有功能分支从这里切出，合并回这里后再 PR 进 `main`
- `feat/*` · `fix/*` · `chore/*` —— 单功能短生命周期分支

---

## 🌐 English

### Overview

`hello-gutsyang` is a modern personal site designed for a "single-author, multi-surface" portfolio:

- **Front-of-house** — A Bento-grid homepage plus dedicated detail pages for experiences, projects and honors, with seamless Chinese/English switching
- **Back-of-house** — A lightweight CMS at `/admin` for editing profile / experiences / honors / projects in the browser, no direct DB access needed
- **AI Chat** — `/chat` connects to DeepSeek so visitors can "ask the author" — identity context is injected via `lib/ai/system-prompt.ts`
- **Resume Export** — `/api/resume.pdf` renders a PDF résumé on-the-fly using `@react-pdf/renderer`

### Tech Stack

| Category | Stack |
| --- | --- |
| Framework | Next.js 14 (App Router · RSC · Server Actions) |
| Language | TypeScript 5 |
| UI | Tailwind CSS · Radix UI · Framer Motion · Lucide |
| i18n | next-intl (default `zh`, fallback `en`, path-prefix strategy) |
| Data / Auth | Supabase (Postgres + Auth + Storage via `@supabase/ssr`) |
| AI | DeepSeek Chat API (streamed through the `ai` SDK) |
| PDF | @react-pdf/renderer |
| Hosting | Vercel (recommended) |

### Getting Started

```bash
npm install
cp .env.example .env       # then fill in the real values
npm run dev                # http://localhost:3000 (redirects to /zh)
```

Required environment variables — see [`.env.example`](./.env.example):

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, **never expose to the client**
- `ADMIN_EMAIL_ALLOWLIST` — comma-separated emails allowed into `/admin`
- `DEEPSEEK_API_KEY` — required for the AI chat surface

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

### Branch Strategy

- `main` — protected release branch, mirrors production
- `develop` — default development branch; feature branches fork from here and merge back before being PR'd to `main`
- `feat/*` · `fix/*` · `chore/*` — short-lived single-purpose branches

---

## 👤 Author

- **Name** — 廖晨扬 / gutsyang (Tony)
- **Handle** — [@gutsyang](https://github.com/guts-yang) (GitHub: `guts-yang`)
- **Repo** — <https://github.com/guts-yang/hello-gutsyang>

## 📄 License

License TBD. Until a license is explicitly added to this repository, all rights are reserved by the author.
