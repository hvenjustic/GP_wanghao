# 项目流程图

> 用于快速说明当前项目的系统结构、项目架构、订单主链路、低代码配置链路和规则执行链路。  
> 渲染方式：建议在支持 Mermaid 的 Markdown 预览器中查看。

| 项目 | 内容 |
| --- | --- |
| 文档用途 | 对齐项目整体流程与模块关系，便于汇报、设计评审和后续开发 |
| 适用范围 | 当前仓库已实现和正在推进的 `P0 / P1` 主流程 |
| 更新时间 | 2026-04-18 |

## 1. 项目架构图

```mermaid
flowchart TB
    subgraph Client[客户端与交互层]
        USER[管理员 / 运营 / 审核 / 配置人员]
        BROWSER[浏览器]
    end

    subgraph App[Next.js 单仓应用]
        subgraph UI[页面层]
            DASHBOARD[首页 / Dashboard]
            ORDER_PAGE[订单页 /orders]
            META_PAGE[低代码页 /meta]
            RULE_PAGE[规则页 /rules]
            USER_PAGE[用户权限页 /users]
            LOG_PAGE[日志页]
        end

        subgraph API[接口层 Route Handlers]
            AUTH_API[认证接口]
            ORDER_API[订单接口]
            META_API[元数据接口]
            RULE_API[规则接口]
            USER_API[用户权限接口]
            LOG_API[日志查询接口]
        end

        subgraph Service[服务层]
            AUTH_SVC[认证与会话服务]
            ORDER_SVC[订单服务]
            META_SVC[低代码配置服务]
            RULE_SVC[规则定义服务]
            RULE_ENGINE[订单规则执行引擎]
            LOG_SVC[审计/日志服务]
        end

        subgraph Runtime[运行时能力]
            META_RUNTIME[低代码运行时解释器]
            PERMISSION[权限守卫 / Middleware]
            DESIGNER[React Flow 规则设计器]
        end
    end

    subgraph Data[数据与持久化层]
        PRISMA[Prisma ORM]
        POSTGRES[(PostgreSQL)]
        USER_TABLE[用户 / 角色 / 权限]
        ORDER_TABLE[订单 / 仓库 / 操作日志]
        META_TABLE[实体 / 字段 / 页面 / 快照]
        RULE_TABLE[规则定义 / 规则版本 / 执行日志]
        AUDIT_TABLE[审计日志]
    end

    USER --> BROWSER --> UI
    UI --> API
    UI --> PERMISSION
    META_PAGE --> META_RUNTIME
    ORDER_PAGE --> META_RUNTIME
    RULE_PAGE --> DESIGNER

    AUTH_API --> AUTH_SVC
    ORDER_API --> ORDER_SVC
    META_API --> META_SVC
    RULE_API --> RULE_SVC
    USER_API --> AUTH_SVC
    LOG_API --> LOG_SVC

    ORDER_SVC --> RULE_ENGINE
    RULE_SVC --> RULE_ENGINE
    META_SVC --> META_RUNTIME

    AUTH_SVC --> PRISMA
    ORDER_SVC --> PRISMA
    META_SVC --> PRISMA
    RULE_SVC --> PRISMA
    RULE_ENGINE --> PRISMA
    LOG_SVC --> PRISMA
    META_RUNTIME --> PRISMA

    PRISMA --> POSTGRES
    POSTGRES --> USER_TABLE
    POSTGRES --> ORDER_TABLE
    POSTGRES --> META_TABLE
    POSTGRES --> RULE_TABLE
    POSTGRES --> AUDIT_TABLE
```

## 2. 系统总览流程图

```mermaid
flowchart LR
    U[系统管理员/订单运营/审核人员/配置人员] --> WEB[Next.js Web 应用]

    subgraph Pages[页面工作台]
        HOME[首页 / Dashboard]
        ORDERS[订单工作台 /orders]
        META[低代码配置台 /meta]
        RULES[规则工作台 /rules]
        USERS[用户权限页 /users]
        LOGS[审计日志 /audit-logs<br/>规则日志 /rule-logs]
    end

    WEB --> HOME
    WEB --> ORDERS
    WEB --> META
    WEB --> RULES
    WEB --> USERS
    WEB --> LOGS

    subgraph API[Route Handlers / API]
        AUTH_API[认证接口]
        ORDER_API[订单接口]
        META_API[元数据接口]
        RULE_API[规则接口]
        USER_API[用户权限接口]
        LOG_API[日志查询接口]
    end

    HOME --> LOG_API
    ORDERS --> ORDER_API
    META --> META_API
    RULES --> RULE_API
    USERS --> USER_API
    LOGS --> LOG_API
    WEB --> AUTH_API

    subgraph SERVICE[服务层]
        AUTH_SVC[Auth Service]
        ORDER_SVC[Order Service]
        META_SVC[Meta Service]
        RULE_SVC[Rule Service]
        ENGINE[Order Rule Engine]
        AUDIT_SVC[Audit / Log Service]
    end

    AUTH_API --> AUTH_SVC
    ORDER_API --> ORDER_SVC
    META_API --> META_SVC
    RULE_API --> RULE_SVC
    USER_API --> AUTH_SVC
    LOG_API --> AUDIT_SVC

    ORDER_SVC --> ENGINE
    RULE_SVC --> ENGINE
    META_SVC --> ORDER_SVC

    subgraph DB[PostgreSQL + Prisma]
        USER_DB[用户/角色/权限]
        ORDER_DB[订单/仓库/操作日志]
        META_DB[实体/字段/页面/快照]
        RULE_DB[规则定义/规则版本/执行日志]
        AUDIT_DB[审计日志]
    end

    AUTH_SVC --> USER_DB
    ORDER_SVC --> ORDER_DB
    META_SVC --> META_DB
    RULE_SVC --> RULE_DB
    ENGINE --> RULE_DB
    ENGINE --> ORDER_DB
    AUDIT_SVC --> AUDIT_DB
```

## 3. 订单主流程图

```mermaid
flowchart TD
    A[订单创建/CSV 导入/API 写入] --> B[进入待审核]
    B --> C{执行审核规则}
    C -->|自动通过| D[进入待分仓]
    C -->|命中风险/需复核| E[进入人工审核]
    C -->|直接拦截| F[驳回/取消并记录原因]

    E --> G{人工审核结果}
    G -->|通过| D
    G -->|驳回| F
    G -->|锁单| H[锁单待处理]

    H --> I{解除锁单?}
    I -->|是| B
    I -->|否| H

    D --> J{分仓策略}
    J -->|自动分仓成功| K[进入待发货]
    J -->|自动分仓失败| L[保留待分仓并记录失败原因]
    J -->|人工改仓| K

    L --> M[运营人员手工改仓]
    M --> K

    K --> N{发货前校验规则}
    N -->|通过| O[录入物流公司/单号并发货]
    N -->|命中阻断规则| P[自动锁单/标记异常]

    P --> Q{解除异常/解锁?}
    Q -->|是| B
    Q -->|否| P

    O --> R[已发货]
    R --> S[已签收/人工确认]
    S --> T[已完成]
```

## 4. 低代码配置流程图

```mermaid
flowchart TD
    A[配置人员进入 /meta] --> B[维护实体 EntityMeta]
    B --> C[维护字段 FieldMeta]
    C --> D[维护页面 PageMeta]
    D --> E[预览当前配置]
    E --> F{是否通过检查}
    F -->|否| G[继续修改实体/字段/页面]
    G --> B
    F -->|是| H[发布单对象版本]
    F -->|是| I[批量发布对象集合]

    H --> J[写入快照/审计日志]
    I --> J

    J --> K[运行时只读取已发布版本]
    K --> L[订单列表页动态加载发布版列表配置]
    K --> M[订单详情页动态加载发布版详情配置]
    K --> N[后续表单页运行时接入]

    J --> O{线上效果异常?}
    O -->|是| P[按快照/历史版本回滚]
    P --> Q[写入回滚日志]
    Q --> K
    O -->|否| R[继续迭代配置]
```

## 5. 规则设计与执行流程图

```mermaid
flowchart TD
    A[配置人员进入 /rules] --> B[创建规则定义]
    B --> C[在 React Flow 设计器中编辑节点和连线]
    C --> D[保存规则版本]
    D --> E[试运行规则]
    E --> F{试运行结果是否符合预期}
    F -->|否| C
    F -->|是| G[发布规则版本]
    G --> H[规则版本写入数据库]

    H --> I[订单动作触发规则引擎]
    I --> J{触发场景}
    J -->|审核通过后| K[执行审核通过后规则]
    J -->|发货前| L[执行发货前校验规则]
    J -->|解除锁单/解除异常| M[重新执行订单创建后规则]

    K --> N[驱动自动分仓/标签/备注]
    L --> O[驱动锁单/异常标记/阻断发货]
    M --> P[驱动重新审核/重新锁单/后续分仓]

    N --> Q[写入订单状态与操作日志]
    O --> Q
    P --> Q

    Q --> R[写入 RuleExecLog]
    R --> S[订单详情页展示规则命中]
    R --> T[规则日志页展示执行结果]
```

## 6. 当前阅读建议

- 看技术设计或做系统汇报时，优先使用“项目架构图”。
- 看汇报或讲项目时，优先使用“系统总览流程图”。
- 讲业务闭环时，优先使用“订单主流程图”。
- 讲低代码平台时，优先使用“低代码配置流程图”。
- 讲规则引擎时，优先使用“规则设计与执行流程图”。

## 7. 说明

- 本文档描述的是当前仓库已经实现或已明确规划到下一阶段的主流程，不包含所有 `P2` 扩展项。
- 若后续补上低代码表单页运行时、规则表达式库、多分支执行器，应优先同步更新本文件。


---

返回入口：[README](../README.md) | 相关内容：[需求文档](requirements.md) / [技术路线文档](tech-roadmap.md) / [进度记录](progress.md)
