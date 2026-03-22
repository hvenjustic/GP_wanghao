# 面向中小电商的低代码订单管理系统

当前仓库已经完成第一步工程初始化，技术基线为 Next.js App Router + TypeScript + PostgreSQL + Prisma + Ant Design + React Flow。

## 当前已完成

- 初始化 `Next.js` 单仓项目基础配置。
- 建立 `src/app`、`features`、`components`、`lib`、`server`、`prisma` 等核心目录。
- 提供项目总览页、登录页、订单列表页、订单详情页、用户权限页、低代码配置页、规则编排页等基础入口。
- 低代码配置页已经接通数据库，支持实体、字段、页面配置的基础 CRUD。
- 低代码配置页已经补上实体、字段、页面三级治理能力，支持预览、发布、克隆新版本、依赖分析和按快照回滚。
- 规则页已经补上规则目录、版本治理、可视化设计器和试运行，支持规则定义和版本落库。
- 规则执行已经接入订单动作链路，审核通过、发货前校验、解除锁单、解除异常会触发规则并直接驱动锁单、审核、分仓等状态变化。
- 提供审计日志查询页和规则执行日志查询页，支持服务端筛选与日志摘要展示。
- 实现基于数据库用户、角色、权限的登录会话与页面访问控制。
- 实现订单列表筛选、订单详情展示、异常标记、批量动作基础版和核心状态流转落库。
- 实现用户状态管理、密码重置和角色权限编辑基础版。
- 提供规则定义、规则版本、规则执行日志和审计日志的演示种子数据，便于联调日志页。
- 提供实体元数据、字段元数据和页面元数据的演示种子数据，便于联调低代码配置页。
- 提供多版本页面元数据、实体字段快照和低代码发布治理审计日志种子数据，便于联调版本治理区块。
- 实现订单数据源切换能力，默认使用内存演示数据，可切换到 Prisma 数据库。
- 提供 `Prisma seed` 脚本，用于初始化示例订单、仓库、客户、账号、角色和权限数据。
- 提供 `Prisma schema`、健康检查接口、Prisma 基础封装和 Zod schema 示例。
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
cp .env.example .env
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

## 当前数据库配置

当前环境模板默认使用 Prisma 数据源。如果你已经配置好 PostgreSQL，只需要复制：

```bash
cp .env.example .env.local
cp .env.example .env
```

如果你只想临时回退到内存演示数据，可以把 `.env.local` 和 `.env` 里的配置改成：

```text
ORDER_DATA_SOURCE="memory"
```

如果你要同步数据库结构和种子数据，执行：

```bash
pnpm db:push
pnpm db:seed
```

## 演示账号

```text
admin@gp.local / Admin123!
ops@gp.local / Ops123!
audit@gp.local / Audit123!
config@gp.local / Config123!
```

## 常用命令

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm db:generate
pnpm db:push
pnpm db:seed
```

## 文档入口

- [需求文档](docs/requirements.md)
- [技术路线文档](docs/tech-roadmap.md)
- [开发任务清单](docs/dev-task-list.md)
- [进度记录](docs/progress.md)

## 下一步建议

- 在订单模块继续补齐导入导出、批量回显和更完整的业务约束。
- 在 `src/app/meta` 下继续补运行时动态渲染、配置差异对比和跨对象依赖拓扑。
- 再补复杂规则节点语义、多分支运行时和规则可解释性。
- 最后补复杂审批流、售后和多租户能力。
