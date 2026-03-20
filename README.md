# 面向中小电商的低代码订单管理系统

当前仓库已经完成第一步工程初始化，技术基线为 Next.js App Router + TypeScript + Prisma + Supabase + Ant Design + React Flow。

## 当前已完成

- 初始化 `Next.js` 单仓项目基础配置。
- 建立 `src/app`、`features`、`components`、`lib`、`server`、`prisma` 等核心目录。
- 提供项目总览页、订单后台页、低代码配置页、规则编排页四个基础入口。
- 提供 `Prisma schema`、健康检查接口、Supabase/Prisma 基础封装和 Zod schema 示例。
- 保留并沿用现有需求文档与技术路线文档。

## 目录结构

```text
docs/                    # 需求与技术文档
prisma/                  # Prisma schema
src/
  app/                   # Next.js App Router 页面与 API
  components/            # 通用布局与基础 UI 组件
  features/              # 业务模块目录
  lib/                   # 配置、数据库、Schema 和第三方客户端
  server/                # 服务层
```

## 本地启动

1. 复制环境变量模板：

```bash
cp .env.example .env.local
```

2. 安装依赖：

```bash
pnpm install
```

3. 启动开发环境：

```bash
pnpm dev
```

4. 打开健康检查接口：

```text
http://localhost:3000/api/health
```

## 常用命令

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm db:generate
pnpm db:push
```

## 文档入口

- [需求文档](docs/requirements.md)
- [技术路线文档](docs/tech-roadmap.md)

## 下一步建议

- 把 `Prisma schema` 拆到首批迁移并接上真实数据库。
- 在 `src/server/services` 中补齐订单、配置、规则三类服务。
- 在 `src/app/orders`、`src/app/meta`、`src/app/rules` 下继续实现真实列表、详情和配置页面。
- 接入 Supabase Auth 与 Row Level Security，补充登录和权限模型。
