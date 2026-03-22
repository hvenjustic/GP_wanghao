import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { hasPermission } from "@/lib/auth/types";
import { requirePermission } from "@/lib/auth/guards";
import { SectionCard } from "@/components/ui/section-card";
import { metaCapabilities } from "@/features/meta/config/meta-capabilities";
import { getMetaManagementOverview } from "@/server/services/meta-service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getStatusClassName(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "status-pill status-pill-green";
    case "DISABLED":
      return "status-pill status-pill-slate";
    case "DRAFT":
      return "status-pill status-pill-amber";
    default:
      return "status-pill status-pill-blue";
  }
}

function buildPreviewHref(entityId: string, pageId?: string) {
  const query = new URLSearchParams();
  query.set("entityPreviewId", entityId);

  if (pageId) {
    query.set("pagePreviewId", pageId);
  }

  return `/meta?${query.toString()}#preview`;
}

export default async function MetaPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const currentUser = await requirePermission("meta:view", "/meta");
  const params = await searchParams;
  const notice = getSingleValue(params.notice);
  const error = getSingleValue(params.error);
  const previewEntityId = getSingleValue(params.entityPreviewId);
  const previewPageId = getSingleValue(params.pagePreviewId);
  const overview = await getMetaManagementOverview({
    entityPreviewId: previewEntityId,
    pagePreviewId: previewPageId
  });
  const canManage = hasPermission(currentUser, "meta:manage");

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">低代码配置平台</h1>
          <p className="app-header-subtitle">
            当前页面已经接上数据库，并补了配置预览、页面发布、版本治理和回滚能力。第一版先把页面版本治理做稳，再逐步扩到更细的配置对象。
          </p>
        </div>
        <div className="app-header-meta">
          {currentUser.name} · {currentUser.roleName}
        </div>
      </header>

      {notice ? <div className="alert-banner alert-banner-success">{notice}</div> : null}
      {error ? <div className="alert-banner alert-banner-error">{error}</div> : null}

      <div className="stats-grid">
        <MetricCard
          label="实体数量"
          value={`${overview.summary.totalEntities} 个`}
          hint="当前数据库中的实体元数据数量。"
        />
        <MetricCard
          label="字段数量"
          value={`${overview.summary.totalFields} 个`}
          hint="字段配置会被页面 Schema 和规则节点引用。"
        />
        <MetricCard
          label="页面配置"
          value={`${overview.summary.totalPages} 份`}
          hint="包含列表页、详情页和表单页的版本配置。"
        />
        <MetricCard
          label="版本分组"
          value={`${overview.summary.versionedPageGroups} 组`}
          hint="按实体和页面编码归并后的页面版本组。"
        />
      </div>

      <div className="three-col-grid">
        {metaCapabilities.map((item) => (
          <SectionCard
            key={item.title}
            eyebrow="配置能力"
            title={item.title}
            description={item.description}
          >
            <div className="chip-row">
              <span className="chip">结构化 Schema</span>
              <span className="chip">统一字段编码</span>
            </div>
          </SectionCard>
        ))}
      </div>

      {!canManage ? (
        <div className="alert-banner">
          当前账号只有查看权限，不能修改配置。如需新增、发布或回滚，请使用具备 `meta:manage` 的账号。
        </div>
      ) : null}

      <div className="two-col-grid">
        <SectionCard
          eyebrow="治理要求"
          title="配置生命周期"
          description="当前先把页面版本的预览、发布、回滚做稳，再逐步扩到更细的对象粒度。"
        >
          <ul className="timeline-list">
            <li>
              <span className="timeline-title">预览</span>
              在不影响线上配置的前提下查看实体字段和页面 Schema 组合结果。
            </li>
            <li>
              <span className="timeline-title">发布</span>
              同一实体下的同一页面编码只允许一个发布版本，其余版本保留历史。
            </li>
            <li>
              <span className="timeline-title">回滚</span>
              可以把旧版本重新发布，并记录操作原因，避免线上行为不可追踪。
            </li>
          </ul>
        </SectionCard>

        <SectionCard
          eyebrow="建议目录"
          title="配置模块拆分方式"
          description="目录先按领域拆，不按技术细枝末节拆，后续更容易维护。"
        >
          <pre className="code-block">{`src/features/meta/
  config/
  components/
  schema/
  services/

prisma/
  schema.prisma`}</pre>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="配置预览"
        title="实体与页面预览"
        description="预览不会直接写库，用于先确认字段定义、页面 Schema 和版本链路是否处于可发布状态。"
      >
        <form className="filter-grid" method="get">
          <label className="form-field">
            <span className="field-label">预览实体</span>
            <select
              className="select-input"
              name="entityPreviewId"
              defaultValue={overview.preview.entity?.id ?? ""}
            >
              {overview.entityOptions.length > 0 ? null : <option value="">暂无实体</option>}
              {overview.entityOptions.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.entityCode} · {entity.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="field-label">预览页面版本</span>
            <select
              className="select-input"
              name="pagePreviewId"
              defaultValue={overview.preview.page?.id ?? ""}
            >
              <option value="">自动选择当前实体下的优先版本</option>
              {overview.preview.pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.pageCode} · v{page.version} · {page.status}
                </option>
              ))}
            </select>
          </label>

          <div className="form-actions">
            <button type="submit" className="button-primary">
              切换预览
            </button>
            <Link href="/meta#preview" className="button-secondary">
              重置预览
            </Link>
          </div>
        </form>

        {overview.preview.entity ? (
          <div id="preview" className="preview-grid">
            <div className="preview-card">
              <div className="table-cell-stack">
                <strong>
                  {overview.preview.entity.name} · {overview.preview.entity.entityCode}
                </strong>
                <span className={getStatusClassName(overview.preview.entity.status)}>
                  {overview.preview.entity.status}
                </span>
                <span className="muted">
                  {overview.preview.entity.fieldCount} 个字段 · {overview.preview.entity.pageCount} 份页面配置
                </span>
              </div>

              <div className="chip-row">
                {overview.preview.fields.length > 0 ? (
                  overview.preview.fields.map((field) => (
                    <span key={field.id} className="chip">
                      {field.fieldCode} · {field.type}
                    </span>
                  ))
                ) : (
                  <span className="muted">当前实体尚未配置字段。</span>
                )}
              </div>

              <ul className="timeline-list">
                {overview.preview.readyChecks.map((check) => (
                  <li key={check.label}>
                    <span className="timeline-title">
                      {check.label} · {check.passed ? "已满足" : "待补齐"}
                    </span>
                    {check.text}
                  </li>
                ))}
              </ul>

              <div className="table-cell-stack">
                <strong>实体 Schema</strong>
                <pre className="code-block">
                  {overview.preview.entity.rawSchema || "// 当前实体未定义附加 Schema"}
                </pre>
              </div>
            </div>

            <div className="preview-card">
              {overview.preview.page ? (
                <>
                  <div className="table-cell-stack">
                    <strong>
                      {overview.preview.page.pageCode} · v{overview.preview.page.version}
                    </strong>
                    <span className="muted">
                      {overview.preview.page.entityName} · {overview.preview.page.pageType}
                    </span>
                    <span className={getStatusClassName(overview.preview.page.status)}>
                      {overview.preview.page.status}
                    </span>
                  </div>

                  <div className="chip-row">
                    {overview.preview.pageGroup?.versions.map((version) => (
                      <Link
                        key={version.id}
                        href={buildPreviewHref(version.entityId, version.id)}
                        className={
                          version.id === overview.preview.page?.id
                            ? "status-pill status-pill-blue"
                            : getStatusClassName(version.status)
                        }
                      >
                        v{version.version}
                      </Link>
                    ))}
                  </div>

                  <pre className="code-block">
                    {overview.preview.page.rawSchema || "// 当前页面未定义 Schema"}
                  </pre>

                  {canManage ? (
                    <div className="action-stack">
                      <form className="inline-form" action="/api/meta/page-versions" method="post">
                        <input type="hidden" name="action" value="clone-version" />
                        <input type="hidden" name="pageId" value={overview.preview.page.id} />
                        <input
                          className="text-input input-compact"
                          name="targetVersion"
                          type="number"
                          min={1}
                          placeholder="新版本号，可留空"
                        />
                        <input
                          className="text-input input-compact"
                          name="note"
                          placeholder="克隆备注，可选"
                        />
                        <button type="submit" className="button-secondary">
                          克隆新版本
                        </button>
                      </form>

                      {overview.preview.page.status !== "PUBLISHED" ? (
                        <form className="inline-form" action="/api/meta/page-versions" method="post">
                          <input type="hidden" name="action" value="publish" />
                          <input type="hidden" name="pageId" value={overview.preview.page.id} />
                          <input
                            className="text-input input-compact"
                            name="note"
                            placeholder="发布备注，可选"
                          />
                          <button type="submit" className="button-primary">
                            发布当前版本
                          </button>
                        </form>
                      ) : null}

                      {overview.preview.pageGroup?.publishedVersion &&
                      overview.preview.pageGroup.publishedVersion !==
                        overview.preview.page.version ? (
                        <form className="inline-form" action="/api/meta/page-versions" method="post">
                          <input type="hidden" name="action" value="rollback" />
                          <input type="hidden" name="pageId" value={overview.preview.page.id} />
                          <input
                            className="text-input"
                            name="reason"
                            placeholder="回滚原因，必填"
                            required
                          />
                          <button type="submit" className="button-danger">
                            回滚到当前版本
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="empty-state">
                  <strong>当前实体还没有可预览的页面版本。</strong>
                  <span className="muted">可以先新增页面配置，再进行预览和发布。</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>当前还没有可预览的低代码配置。</strong>
            <span className="muted">请先新增实体和页面配置。</span>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="版本治理"
        title="页面发布、克隆与回滚"
        description="当前按“实体 + 页面编码”作为一个版本组进行治理。发布会自动替换当前线上版本，回滚会重新激活旧版本。"
      >
        {overview.pageGroups.length > 0 ? (
          <div className="version-group-list">
            {overview.pageGroups.map((group) => (
              <article key={group.key} className="version-card">
                <div className="version-card-header">
                  <div className="table-cell-stack">
                    <strong>
                      {group.entityCode} · {group.pageCode}
                    </strong>
                    <span className="muted">
                      {group.entityName} · {group.pageType} · {group.versionCount} 个版本
                    </span>
                  </div>
                  <div className="chip-row">
                    <span className="status-pill status-pill-blue">
                      最新 v{group.latestVersion ?? "-"}
                    </span>
                    <span className={group.publishedVersion ? "status-pill status-pill-green" : "status-pill status-pill-slate"}>
                      {group.publishedVersion ? `线上 v${group.publishedVersion}` : "未发布"}
                    </span>
                    <span className="status-pill status-pill-amber">
                      草稿 {group.draftCount} 个
                    </span>
                  </div>
                </div>

                <div className="version-list">
                  {group.versions.map((version) => (
                    <div key={version.id} className="version-row">
                      <div className="version-row-head">
                        <div className="table-cell-stack">
                          <strong>
                            v{version.version} · {version.pageType}
                          </strong>
                          <span className="muted">{version.updatedAt}</span>
                          <span className={getStatusClassName(version.status)}>{version.status}</span>
                        </div>
                        <Link
                          href={buildPreviewHref(version.entityId, version.id)}
                          className="button-secondary"
                        >
                          预览此版本
                        </Link>
                      </div>

                      <div className="muted">{version.schemaPreview}</div>

                      {canManage ? (
                        <div className="action-stack">
                          <form className="inline-form" action="/api/meta/page-versions" method="post">
                            <input type="hidden" name="action" value="clone-version" />
                            <input type="hidden" name="pageId" value={version.id} />
                            <input
                              className="text-input input-compact"
                              name="targetVersion"
                              type="number"
                              min={1}
                              placeholder="新版本号，可留空"
                            />
                            <button type="submit" className="button-secondary">
                              克隆为新版本
                            </button>
                          </form>

                          {version.status !== "PUBLISHED" ? (
                            <form className="inline-form" action="/api/meta/page-versions" method="post">
                              <input type="hidden" name="action" value="publish" />
                              <input type="hidden" name="pageId" value={version.id} />
                              <input
                                className="text-input input-compact"
                                name="note"
                                placeholder="发布备注，可选"
                              />
                              <button type="submit" className="button-primary">
                                发布此版本
                              </button>
                            </form>
                          ) : null}

                          {group.publishedVersion && group.publishedVersion !== version.version ? (
                            <form className="inline-form" action="/api/meta/page-versions" method="post">
                              <input type="hidden" name="action" value="rollback" />
                              <input type="hidden" name="pageId" value={version.id} />
                              <input
                                className="text-input"
                                name="reason"
                                placeholder="回滚原因，必填"
                                required
                              />
                              <button type="submit" className="button-danger">
                                回滚到此版本
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>当前还没有页面版本组。</strong>
            <span className="muted">先新增页面配置，版本治理区块才会出现内容。</span>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="发布历史"
        title="最近的发布与回滚记录"
        description="当前先复用审计日志作为发布历史来源，确保每次克隆、发布、回滚都有操作留痕。"
      >
        {overview.releaseHistory.length > 0 ? (
          <ul className="timeline-list">
            {overview.releaseHistory.map((item) => (
              <li key={item.id}>
                <span className="timeline-title">
                  {item.action} · {item.createdAt}
                </span>
                {item.operatorName} 操作了 {item.targetType} / {item.targetId}
                <div className="table-cell-stack">
                  {item.detailEntries.map((entry) => (
                    <span key={`${item.id}-${entry}`} className="muted">
                      {entry}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <strong>当前还没有发布治理记录。</strong>
            <span className="muted">执行页面发布、克隆或回滚后，这里会出现历史记录。</span>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="实体配置"
        title="实体建模 CRUD"
        description="实体是字段和页面配置的挂载点。实体编码建议保持稳定，不要随意重命名。"
      >
        {canManage ? (
          <form className="meta-form-grid" action="/api/meta/entities" method="post">
            <input type="hidden" name="action" value="create" />
            <label className="form-field">
              <span className="field-label">实体编码</span>
              <input
                className="text-input"
                name="entityCode"
                placeholder="例如 ORDER_EXTENSION"
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">实体名称</span>
              <input className="text-input" name="name" placeholder="例如 订单扩展模型" required />
            </label>
            <label className="form-field">
              <span className="field-label">实体类型</span>
              <select
                className="select-input"
                name="type"
                defaultValue={overview.options.entityTypes[0]}
              >
                {overview.options.entityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">状态</span>
              <select className="select-input" name="status" defaultValue="DRAFT">
                {overview.options.recordStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field meta-form-span-2">
              <span className="field-label">Schema JSON</span>
              <textarea
                className="textarea-input"
                name="schemaText"
                placeholder={`{\n  "owner": "订单中台",\n  "editable": true\n}`}
              />
            </label>
            <div className="form-actions meta-form-actions">
              <button type="submit" className="button-primary">
                新增实体
              </button>
            </div>
          </form>
        ) : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>实体</th>
              <th>类型 / 状态</th>
              <th>字段 / 页面</th>
              <th>Schema 摘要</th>
              <th>更新时间</th>
              {canManage ? <th>维护</th> : null}
            </tr>
          </thead>
          <tbody>
            {overview.entities.map((entity) => (
              <tr key={entity.id}>
                <td>
                  <div className="table-cell-stack">
                    <strong>{entity.name}</strong>
                    <span className="muted">{entity.entityCode}</span>
                  </div>
                </td>
                <td>
                  <div className="table-cell-stack">
                    <span className="status-pill status-pill-blue">{entity.type}</span>
                    <span className={getStatusClassName(entity.status)}>{entity.status}</span>
                  </div>
                </td>
                <td>
                  <div className="table-cell-stack">
                    <span>{entity.fieldCount} 个字段</span>
                    <span className="muted">{entity.pageCount} 份页面配置</span>
                  </div>
                </td>
                <td className="muted">{entity.schemaPreview}</td>
                <td>{entity.updatedAt}</td>
                {canManage ? (
                  <td>
                    <div className="action-stack">
                      <Link href={buildPreviewHref(entity.id)} className="button-secondary">
                        预览实体
                      </Link>
                      <form
                        className="table-form table-form-wide"
                        action="/api/meta/entities"
                        method="post"
                      >
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="id" value={entity.id} />
                        <input
                          className="text-input"
                          name="entityCode"
                          defaultValue={entity.entityCode}
                          required
                        />
                        <input className="text-input" name="name" defaultValue={entity.name} required />
                        <select className="select-input" name="type" defaultValue={entity.type}>
                          {overview.options.entityTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <select className="select-input" name="status" defaultValue={entity.status}>
                          {overview.options.recordStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <textarea
                          className="textarea-input textarea-input-compact"
                          name="schemaText"
                          defaultValue={entity.rawSchema}
                        />
                        <button type="submit" className="button-secondary">
                          保存实体
                        </button>
                      </form>
                      <form action="/api/meta/entities" method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={entity.id} />
                        <button type="submit" className="button-danger">
                          删除实体
                        </button>
                      </form>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        eyebrow="字段配置"
        title="字段治理 CRUD"
        description="字段编码建议按小写下划线命名，后续才能稳定地被页面 Schema 和规则节点引用。"
      >
        {canManage ? (
          <form className="meta-form-grid" action="/api/meta/fields" method="post">
            <input type="hidden" name="action" value="create" />
            <label className="form-field">
              <span className="field-label">所属实体</span>
              <select
                className="select-input"
                name="entityId"
                defaultValue={overview.entityOptions[0]?.id ?? ""}
              >
                {overview.entityOptions.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.entityCode} · {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">字段编码</span>
              <input
                className="text-input"
                name="fieldCode"
                placeholder="例如 delivery_priority"
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">字段名称</span>
              <input className="text-input" name="name" placeholder="例如 履约优先级" required />
            </label>
            <label className="form-field">
              <span className="field-label">字段类型</span>
              <select
                className="select-input"
                name="type"
                defaultValue={overview.options.fieldTypes[0]}
              >
                {overview.options.fieldTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-line">
              <input type="checkbox" name="required" value="true" />
              设置为必填字段
            </label>
            <label className="form-field meta-form-span-2">
              <span className="field-label">Schema JSON</span>
              <textarea
                className="textarea-input"
                name="schemaText"
                placeholder={`{\n  "listVisible": true,\n  "formVisible": true\n}`}
              />
            </label>
            <div className="form-actions meta-form-actions">
              <button type="submit" className="button-primary">
                新增字段
              </button>
            </div>
          </form>
        ) : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>所属实体</th>
              <th>类型 / 必填</th>
              <th>Schema 摘要</th>
              <th>更新时间</th>
              {canManage ? <th>维护</th> : null}
            </tr>
          </thead>
          <tbody>
            {overview.fields.map((field) => (
              <tr key={field.id}>
                <td>
                  <div className="table-cell-stack">
                    <strong>{field.name}</strong>
                    <span className="muted">{field.fieldCode}</span>
                  </div>
                </td>
                <td>
                  <div className="table-cell-stack">
                    <span>{field.entityName}</span>
                    <span className="muted">{field.entityCode}</span>
                  </div>
                </td>
                <td>
                  <div className="table-cell-stack">
                    <span className="status-pill status-pill-blue">{field.type}</span>
                    <span
                      className={
                        field.required
                          ? "status-pill status-pill-amber"
                          : "status-pill status-pill-slate"
                      }
                    >
                      {field.required ? "必填" : "选填"}
                    </span>
                  </div>
                </td>
                <td className="muted">{field.schemaPreview}</td>
                <td>{field.updatedAt}</td>
                {canManage ? (
                  <td>
                    <div className="action-stack">
                      <form
                        className="table-form table-form-wide"
                        action="/api/meta/fields"
                        method="post"
                      >
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="id" value={field.id} />
                        <select className="select-input" name="entityId" defaultValue={field.entityId}>
                          {overview.entityOptions.map((entity) => (
                            <option key={entity.id} value={entity.id}>
                              {entity.entityCode} · {entity.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="text-input"
                          name="fieldCode"
                          defaultValue={field.fieldCode}
                          required
                        />
                        <input className="text-input" name="name" defaultValue={field.name} required />
                        <select className="select-input" name="type" defaultValue={field.type}>
                          {overview.options.fieldTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <label className="checkbox-line">
                          <input
                            type="checkbox"
                            name="required"
                            value="true"
                            defaultChecked={field.required}
                          />
                          设置为必填字段
                        </label>
                        <textarea
                          className="textarea-input textarea-input-compact"
                          name="schemaText"
                          defaultValue={field.rawSchema}
                        />
                        <button type="submit" className="button-secondary">
                          保存字段
                        </button>
                      </form>
                      <form action="/api/meta/fields" method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={field.id} />
                        <button type="submit" className="button-danger">
                          删除字段
                        </button>
                      </form>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        eyebrow="页面配置"
        title="页面 Schema CRUD"
        description="当前先管理列表、详情、表单三类页面配置。页面编码和版本号共同构成运行中的可追踪版本。"
      >
        {canManage ? (
          <form className="meta-form-grid" action="/api/meta/pages" method="post">
            <input type="hidden" name="action" value="create" />
            <label className="form-field">
              <span className="field-label">所属实体</span>
              <select
                className="select-input"
                name="entityId"
                defaultValue={overview.entityOptions[0]?.id ?? ""}
              >
                {overview.entityOptions.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.entityCode} · {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">页面编码</span>
              <input
                className="text-input"
                name="pageCode"
                placeholder="例如 order_extension_list"
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">页面类型</span>
              <select
                className="select-input"
                name="pageType"
                defaultValue={overview.options.pageTypes[0]}
              >
                {overview.options.pageTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">版本号</span>
              <input
                className="text-input"
                name="version"
                type="number"
                min={1}
                defaultValue={1}
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">状态</span>
              <select className="select-input" name="status" defaultValue="DRAFT">
                {overview.options.recordStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field meta-form-span-full">
              <span className="field-label">Schema JSON</span>
              <textarea
                className="textarea-input"
                name="schemaText"
                placeholder={`{\n  "fields": ["delivery_priority"],\n  "actions": ["saveDraft"]\n}`}
                required
              />
            </label>
            <div className="form-actions meta-form-actions">
              <button type="submit" className="button-primary">
                新增页面配置
              </button>
            </div>
          </form>
        ) : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>页面</th>
              <th>所属实体</th>
              <th>类型 / 状态</th>
              <th>Schema 摘要</th>
              <th>更新时间</th>
              {canManage ? <th>维护</th> : null}
            </tr>
          </thead>
          <tbody>
            {overview.pages.map((page) => (
              <tr key={page.id}>
                <td>
                  <div className="table-cell-stack">
                    <strong>{page.pageCode}</strong>
                    <span className="muted">v{page.version}</span>
                  </div>
                </td>
                <td>
                  <div className="table-cell-stack">
                    <span>{page.entityName}</span>
                    <span className="muted">{page.entityCode}</span>
                  </div>
                </td>
                <td>
                  <div className="table-cell-stack">
                    <span className="status-pill status-pill-blue">{page.pageType}</span>
                    <span className={getStatusClassName(page.status)}>{page.status}</span>
                  </div>
                </td>
                <td className="muted">{page.schemaPreview}</td>
                <td>{page.updatedAt}</td>
                {canManage ? (
                  <td>
                    <div className="action-stack">
                      <Link href={buildPreviewHref(page.entityId, page.id)} className="button-secondary">
                        预览此页
                      </Link>
                      <form className="table-form table-form-wide" action="/api/meta/pages" method="post">
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="id" value={page.id} />
                        <select className="select-input" name="entityId" defaultValue={page.entityId}>
                          {overview.entityOptions.map((entity) => (
                            <option key={entity.id} value={entity.id}>
                              {entity.entityCode} · {entity.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="text-input"
                          name="pageCode"
                          defaultValue={page.pageCode}
                          required
                        />
                        <select className="select-input" name="pageType" defaultValue={page.pageType}>
                          {overview.options.pageTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <input
                          className="text-input"
                          name="version"
                          type="number"
                          min={1}
                          defaultValue={page.version}
                          required
                        />
                        <select className="select-input" name="status" defaultValue={page.status}>
                          {overview.options.recordStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <textarea
                          className="textarea-input textarea-input-compact"
                          name="schemaText"
                          defaultValue={page.rawSchema}
                          required
                        />
                        <button type="submit" className="button-secondary">
                          保存页面配置
                        </button>
                      </form>
                      <form action="/api/meta/pages" method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={page.id} />
                        <button type="submit" className="button-danger">
                          删除页面配置
                        </button>
                      </form>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
