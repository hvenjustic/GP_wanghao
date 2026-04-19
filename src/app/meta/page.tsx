import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { hasPermission } from "@/lib/auth/types";
import { requirePermission } from "@/lib/auth/guards";
import { SectionCard } from "@/components/ui/section-card";
import { metaCapabilities } from "@/features/meta/config/meta-capabilities";
import { consumeMetaBatchFeedback } from "@/server/services/meta-batch-feedback-store";
import { getMetaManagementOverview } from "@/server/services/meta-service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type MetaHrefInput = {
  entityId: string;
  pageId?: string;
  fieldId?: string;
  entityDiffSnapshotId?: string;
  fieldDiffSnapshotId?: string;
  pageDiffId?: string;
  anchor?: string;
};

type MetaBatchCandidateItem = {
  ref: string;
  label: string;
  description: string;
};

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

function getDiffKindClassName(kind: string) {
  switch (kind) {
    case "ADDED":
      return "status-pill status-pill-green";
    case "REMOVED":
      return "status-pill status-pill-red";
    case "CHANGED":
      return "status-pill status-pill-amber";
    default:
      return "status-pill status-pill-blue";
  }
}

function getDiffKindLabel(kind: string) {
  switch (kind) {
    case "ADDED":
      return "新增";
    case "REMOVED":
      return "删除";
    case "CHANGED":
      return "变更";
    default:
      return kind;
  }
}

function getBatchResultClassName(ok: boolean) {
  return ok ? "status-pill status-pill-green" : "status-pill status-pill-red";
}

function buildMetaHref(input: MetaHrefInput) {
  const query = new URLSearchParams();
  query.set("entityPreviewId", input.entityId);

  if (input.pageId) {
    query.set("pagePreviewId", input.pageId);
  }

  if (input.fieldId) {
    query.set("fieldPreviewId", input.fieldId);
  }

  if (input.entityDiffSnapshotId) {
    query.set("entityDiffSnapshotId", input.entityDiffSnapshotId);
  }

  if (input.fieldDiffSnapshotId) {
    query.set("fieldDiffSnapshotId", input.fieldDiffSnapshotId);
  }

  if (input.pageDiffId) {
    query.set("pageDiffId", input.pageDiffId);
  }

  return `/meta?${query.toString()}${input.anchor ? `#${input.anchor}` : ""}`;
}

function buildPreviewHref(entityId: string, pageId?: string, fieldId?: string) {
  return buildMetaHref({
    entityId,
    pageId,
    fieldId,
    anchor: "preview"
  });
}

function buildCurrentMetaUrl(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "notice" || key === "error" || key === "batchFeedbackId") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          query.append(key, item);
        }
      }
      continue;
    }

    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return `/meta${queryString ? `?${queryString}` : ""}`;
}

function BatchCandidateChecklist({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: MetaBatchCandidateItem[];
}) {
  return (
    <div className="version-row">
      <div className="table-cell-stack">
        <strong>{title}</strong>
        <span className="muted">{description}</span>
      </div>

      {items.length > 0 ? (
        <div className="checkbox-grid">
          {items.map((item) => (
            <label key={item.ref} className="checkbox-line">
              <input type="checkbox" name="targetRefs" value={item.ref} />
              <span className="table-cell-stack">
                <strong>{item.label}</strong>
                <span className="muted">{item.description}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>当前没有可选对象。</strong>
          <span className="muted">先新增草稿或保留历史版本后，这里才会出现候选集。</span>
        </div>
      )}
    </div>
  );
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
  const previewFieldId = getSingleValue(params.fieldPreviewId);
  const entityDiffSnapshotId = getSingleValue(params.entityDiffSnapshotId);
  const fieldDiffSnapshotId = getSingleValue(params.fieldDiffSnapshotId);
  const pageDiffId = getSingleValue(params.pageDiffId);
  const batchFeedbackId = getSingleValue(params.batchFeedbackId);
  const overview = await getMetaManagementOverview({
    entityPreviewId: previewEntityId,
    pagePreviewId: previewPageId,
    fieldPreviewId: previewFieldId,
    entityDiffSnapshotId,
    fieldDiffSnapshotId,
    pageDiffId
  });
  const batchFeedback = batchFeedbackId ? consumeMetaBatchFeedback(batchFeedbackId) : null;
  const canManage = hasPermission(currentUser, "meta:manage");
  const topology = overview.preview.topology;
  const redirectTo = `${buildCurrentMetaUrl(params)}#batch-governance`;

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <h1 className="app-header-title">低代码配置平台</h1>
          <p className="app-header-subtitle">
            用于管理实体、字段、页面配置以及对应的预览、发布、版本治理和回滚操作。
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
          description="通过预览、发布、回滚和版本记录管理配置生命周期。"
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
          description="按实体、字段、页面和服务能力组织配置模块。"
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
            <span className="field-label">焦点字段</span>
            <select
              className="select-input"
              name="fieldPreviewId"
              defaultValue={overview.preview.field?.id ?? ""}
            >
              <option value="">自动选择当前实体下的优先字段</option>
              {overview.fieldOptions.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.fieldCode} · {field.name}
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
                <span className="muted">当前版本 v{overview.preview.entity.version}</span>
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
                    <Link
                      key={field.id}
                      href={buildPreviewHref(
                        overview.preview.entity?.id ?? "",
                        overview.preview.page?.id,
                        field.id
                      )}
                      className={field.id === overview.preview.field?.id ? "status-pill status-pill-blue" : "chip"}
                    >
                      {field.fieldCode} · {field.type}
                    </Link>
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
        eyebrow="配置差异"
        title="版本差异对比"
        description="默认把当前焦点对象与最近可用的历史基线做对比。切换下方快照或版本后，可以直接看到字段、Schema 和状态差异。"
      >
        {overview.preview.entity ? (
          <div id="diff" className="three-col-grid">
            <div className="version-card">
              <div className="table-cell-stack">
                <strong>实体差异</strong>
                <span className="muted">
                  {overview.diffs.entity?.currentLabel ?? "当前没有实体焦点"}
                </span>
                <span className="muted">
                  对比基线：{overview.diffs.entity?.baselineLabel ?? "暂无可对比快照"}
                </span>
              </div>

              <div className="chip-row">
                <span className="status-pill status-pill-blue">
                  共 {overview.diffs.entity?.summary.total ?? 0} 项
                </span>
                <span className="status-pill status-pill-green">
                  新增 {overview.diffs.entity?.summary.addedCount ?? 0}
                </span>
                <span className="status-pill status-pill-red">
                  删除 {overview.diffs.entity?.summary.removedCount ?? 0}
                </span>
                <span className="status-pill status-pill-amber">
                  变更 {overview.diffs.entity?.summary.changedCount ?? 0}
                </span>
              </div>

              <div className="chip-row">
                {overview.entitySnapshots
                  .filter((snapshot) => snapshot.version !== overview.preview.entity?.version)
                  .map((snapshot) => (
                    <Link
                      key={snapshot.id}
                      href={buildMetaHref({
                        entityId: overview.preview.entity?.id ?? "",
                        pageId: overview.preview.page?.id,
                        fieldId: overview.preview.field?.id,
                        entityDiffSnapshotId: snapshot.id,
                        fieldDiffSnapshotId: overview.diffs.field?.baselineId ?? undefined,
                        pageDiffId: overview.diffs.page?.baselineId ?? undefined,
                        anchor: "diff"
                      })}
                      className={
                        snapshot.id === overview.diffs.entity?.baselineId
                          ? "status-pill status-pill-blue"
                          : "chip"
                      }
                    >
                      实体快照 v{snapshot.version}
                    </Link>
                  ))}
              </div>

              {overview.diffs.entity?.entries.length ? (
                <ul className="timeline-list">
                  {overview.diffs.entity.entries.map((entry) => (
                    <li key={`entity-diff-${entry.path}`}>
                      <span className="timeline-title">
                        {entry.path} ·{" "}
                        <span className={getDiffKindClassName(entry.kind)}>
                          {getDiffKindLabel(entry.kind)}
                        </span>
                      </span>
                      <span className="muted">之前：{entry.before}</span>
                      <br />
                      <span className="muted">现在：{entry.after}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <strong>当前实体没有可展示的差异项。</strong>
                  <span className="muted">如果没有历史快照或配置未变化，这里会保持空状态。</span>
                </div>
              )}
            </div>

            <div className="version-card">
              <div className="table-cell-stack">
                <strong>字段差异</strong>
                <span className="muted">
                  {overview.diffs.field?.currentLabel ?? "当前没有字段焦点"}
                </span>
                <span className="muted">
                  对比基线：{overview.diffs.field?.baselineLabel ?? "暂无可对比快照"}
                </span>
              </div>

              <div className="chip-row">
                <span className="status-pill status-pill-blue">
                  共 {overview.diffs.field?.summary.total ?? 0} 项
                </span>
                <span className="status-pill status-pill-green">
                  新增 {overview.diffs.field?.summary.addedCount ?? 0}
                </span>
                <span className="status-pill status-pill-red">
                  删除 {overview.diffs.field?.summary.removedCount ?? 0}
                </span>
                <span className="status-pill status-pill-amber">
                  变更 {overview.diffs.field?.summary.changedCount ?? 0}
                </span>
              </div>

              <div className="chip-row">
                {overview.fieldSnapshots
                  .filter((snapshot) => snapshot.version !== overview.preview.field?.version)
                  .map((snapshot) => (
                    <Link
                      key={snapshot.id}
                      href={buildMetaHref({
                        entityId: overview.preview.entity?.id ?? "",
                        pageId: overview.preview.page?.id,
                        fieldId: overview.preview.field?.id,
                        entityDiffSnapshotId: overview.diffs.entity?.baselineId ?? undefined,
                        fieldDiffSnapshotId: snapshot.id,
                        pageDiffId: overview.diffs.page?.baselineId ?? undefined,
                        anchor: "diff"
                      })}
                      className={
                        snapshot.id === overview.diffs.field?.baselineId
                          ? "status-pill status-pill-blue"
                          : "chip"
                      }
                    >
                      字段快照 v{snapshot.version}
                    </Link>
                  ))}
              </div>

              {overview.diffs.field?.entries.length ? (
                <ul className="timeline-list">
                  {overview.diffs.field.entries.map((entry) => (
                    <li key={`field-diff-${entry.path}`}>
                      <span className="timeline-title">
                        {entry.path} ·{" "}
                        <span className={getDiffKindClassName(entry.kind)}>
                          {getDiffKindLabel(entry.kind)}
                        </span>
                      </span>
                      <span className="muted">之前：{entry.before}</span>
                      <br />
                      <span className="muted">现在：{entry.after}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <strong>当前字段没有可展示的差异项。</strong>
                  <span className="muted">可以从字段快照中切换不同基线查看差异。</span>
                </div>
              )}
            </div>

            <div className="version-card">
              <div className="table-cell-stack">
                <strong>页面差异</strong>
                <span className="muted">
                  {overview.diffs.page?.currentLabel ?? "当前没有页面焦点"}
                </span>
                <span className="muted">
                  对比基线：{overview.diffs.page?.baselineLabel ?? "暂无可对比版本"}
                </span>
              </div>

              <div className="chip-row">
                <span className="status-pill status-pill-blue">
                  共 {overview.diffs.page?.summary.total ?? 0} 项
                </span>
                <span className="status-pill status-pill-green">
                  新增 {overview.diffs.page?.summary.addedCount ?? 0}
                </span>
                <span className="status-pill status-pill-red">
                  删除 {overview.diffs.page?.summary.removedCount ?? 0}
                </span>
                <span className="status-pill status-pill-amber">
                  变更 {overview.diffs.page?.summary.changedCount ?? 0}
                </span>
              </div>

              <div className="chip-row">
                {overview.preview.pageGroup?.versions
                  .filter((version) => version.id !== overview.preview.page?.id)
                  .map((version) => (
                    <Link
                      key={version.id}
                      href={buildMetaHref({
                        entityId: overview.preview.entity?.id ?? "",
                        pageId: overview.preview.page?.id,
                        fieldId: overview.preview.field?.id,
                        entityDiffSnapshotId: overview.diffs.entity?.baselineId ?? undefined,
                        fieldDiffSnapshotId: overview.diffs.field?.baselineId ?? undefined,
                        pageDiffId: version.id,
                        anchor: "diff"
                      })}
                      className={
                        version.id === overview.diffs.page?.baselineId
                          ? "status-pill status-pill-blue"
                          : "chip"
                      }
                    >
                      页面 v{version.version}
                    </Link>
                  ))}
              </div>

              {overview.diffs.page?.entries.length ? (
                <ul className="timeline-list">
                  {overview.diffs.page.entries.map((entry) => (
                    <li key={`page-diff-${entry.path}`}>
                      <span className="timeline-title">
                        {entry.path} ·{" "}
                        <span className={getDiffKindClassName(entry.kind)}>
                          {getDiffKindLabel(entry.kind)}
                        </span>
                      </span>
                      <span className="muted">之前：{entry.before}</span>
                      <br />
                      <span className="muted">现在：{entry.after}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <strong>当前页面没有可展示的差异项。</strong>
                  <span className="muted">如果只有一个页面版本或配置完全一致，这里会保持空状态。</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>当前还没有可对比的低代码配置。</strong>
            <span className="muted">请先选择实体、字段或页面，再查看版本差异。</span>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="依赖拓扑"
        title="页面、字段与规则引用关系"
        description="这里把当前预览实体下的字段、页面版本和规则版本串起来，帮助判断某个字段改动会波及哪些配置对象。"
      >
        {topology ? (
          <>
            <div className="chip-row">
              <span className="status-pill status-pill-blue">节点 {topology.summary.nodeCount}</span>
              <span className="status-pill status-pill-blue">关系 {topology.summary.edgeCount}</span>
              <span className="status-pill status-pill-green">
                页面引用 {topology.summary.pageReferenceCount}
              </span>
              <span className="status-pill status-pill-amber">
                规则引用 {topology.summary.ruleReferenceCount}
              </span>
            </div>

            <div className="three-col-grid">
              <div className="version-card">
                <div className="table-cell-stack">
                  <strong>字段节点</strong>
                  <span className="muted">
                    当前实体共有 {topology.summary.fieldCount} 个字段节点。
                  </span>
                </div>
                {topology.fieldItems.length > 0 ? (
                  <ul className="timeline-list">
                    {topology.fieldItems.map((field) => (
                      <li key={field.id}>
                        <span className="timeline-title">
                          {field.fieldCode} · {field.name}
                        </span>
                        <span className={getStatusClassName(field.status)}>{field.status}</span>
                        <br />
                        <span className="muted">
                          页面引用 {field.pageRefCount} 次，其中已发布 {field.publishedPageRefCount} 次；规则引用{" "}
                          {field.ruleRefCount} 次，其中活跃规则 {field.activeRuleRefCount} 次。
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">
                    <strong>当前实体下没有字段。</strong>
                    <span className="muted">请先新增字段后再查看依赖拓扑。</span>
                  </div>
                )}
              </div>

              <div className="version-card">
                <div className="table-cell-stack">
                  <strong>页面节点</strong>
                  <span className="muted">
                    当前实体共有 {topology.summary.pageCount} 个页面版本节点。
                  </span>
                </div>
                {topology.pageItems.length > 0 ? (
                  <ul className="timeline-list">
                    {topology.pageItems.map((page) => (
                      <li key={page.id}>
                        <span className="timeline-title">
                          {page.pageCode} · v{page.version}
                        </span>
                        <span className={getStatusClassName(page.status)}>{page.status}</span>
                        <br />
                        <span className="muted">
                          {page.pageType} · 引用字段：
                          {page.matchedFieldCodes.length > 0
                            ? ` ${page.matchedFieldCodes.join(" / ")}`
                            : " 当前没有低代码字段引用"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">
                    <strong>当前实体下没有页面版本。</strong>
                    <span className="muted">请先新增页面配置后再查看依赖拓扑。</span>
                  </div>
                )}
              </div>

              <div className="version-card">
                <div className="table-cell-stack">
                  <strong>规则节点</strong>
                  <span className="muted">
                    当前实体相关字段共命中 {topology.summary.ruleCount} 个规则版本节点。
                  </span>
                </div>
                {topology.ruleItems.length > 0 ? (
                  <ul className="timeline-list">
                    {topology.ruleItems.map((rule) => (
                      <li key={rule.versionId}>
                        <span className="timeline-title">
                          {rule.ruleCode} · v{rule.version}
                        </span>
                        <span
                          className={
                            rule.isActive
                              ? "status-pill status-pill-green"
                              : "status-pill status-pill-slate"
                          }
                        >
                          {rule.isActive ? "活跃版本" : "历史版本"}
                        </span>
                        <br />
                        <span className="muted">
                          {rule.ruleName} · {rule.scene} · 引用字段 {rule.referencedFields.join(" / ")}
                        </span>
                        <br />
                        <span className="muted">
                          命中节点：{rule.nodeLabels.length > 0 ? rule.nodeLabels.join(" / ") : "未识别"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">
                    <strong>当前实体字段还没有规则引用。</strong>
                    <span className="muted">规则图引用这些字段时，会自动出现在这里。</span>
                  </div>
                )}
              </div>
            </div>

            <div className="version-card">
              <div className="table-cell-stack">
                <strong>关系边清单</strong>
                <span className="muted">
                  从“实体 → 字段 / 页面”，再到“字段 → 页面 / 规则”逐条展示当前拓扑关系。
                </span>
              </div>
              <ul className="timeline-list">
                {topology.edges.map((edge) => {
                  const sourceNode = topology.nodes.find((node) => node.id === edge.sourceId);
                  const targetNode = topology.nodes.find((node) => node.id === edge.targetId);

                  return (
                    <li key={edge.id}>
                      <span className="timeline-title">
                        {sourceNode?.label ?? edge.sourceId} → {targetNode?.label ?? edge.targetId}
                      </span>
                      <span className="muted">
                        {edge.label} · {edge.kind}
                      </span>
                      <br />
                      <span className="muted">
                        {sourceNode?.detail ?? "无节点详情"} / {targetNode?.detail ?? "无节点详情"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>当前还没有可展示的依赖拓扑。</strong>
            <span className="muted">请先选择实体，再查看字段、页面和规则之间的引用关系。</span>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="批量治理"
        title="批量发布与回滚"
        description="当前批量治理直接复用单对象版本治理规则，支持一次选择多类对象执行发布或回滚，并返回逐项结果。"
      >
        <div id="batch-governance" className="batch-panel">
          <div className="chip-row">
            <span className="status-pill status-pill-blue">
              可批量发布 {overview.batchCandidates.publish.entities.length + overview.batchCandidates.publish.fields.length + overview.batchCandidates.publish.pages.length} 项
            </span>
            <span className="status-pill status-pill-amber">
              可批量回滚 {overview.batchCandidates.rollback.entities.length + overview.batchCandidates.rollback.fields.length + overview.batchCandidates.rollback.pages.length} 项
            </span>
          </div>

          {batchFeedback ? (
            <div className="batch-feedback-card">
              <div className="batch-feedback-summary">
                <div className="table-cell-stack">
                  <strong>
                    {batchFeedback.action === "publish" ? "批量发布结果" : "批量回滚结果"}
                  </strong>
                  <span className="muted">{batchFeedback.createdAt}</span>
                </div>
                <div className="chip-row">
                  <span className="status-pill status-pill-blue">
                    共 {batchFeedback.summary.total} 项
                  </span>
                  <span className="status-pill status-pill-green">
                    成功 {batchFeedback.summary.successCount} 项
                  </span>
                  <span className="status-pill status-pill-red">
                    失败 {batchFeedback.summary.failedCount} 项
                  </span>
                </div>
              </div>

              <ul className="timeline-list">
                {batchFeedback.items.map((item) => (
                  <li key={`${batchFeedback.id}-${item.ref}`}>
                    <span className="timeline-title">
                      {item.label} · <span className={getBatchResultClassName(item.ok)}>{item.ok ? "成功" : "失败"}</span>
                    </span>
                    <span className="muted">
                      {item.targetType} · {item.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="two-col-grid">
            <div className="version-card">
              <div className="table-cell-stack">
                <strong>批量发布</strong>
                <span className="muted">
                  适用于草稿或停用中的实体、字段、页面版本。仍会执行单对象发布校验，失败项不会阻塞其他对象。
                </span>
              </div>

              <form className="action-stack" action="/api/meta/batch-versions" method="post">
                <input type="hidden" name="action" value="publish" />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <label className="form-field">
                  <span className="field-label">批量发布备注</span>
                  <input
                    className="text-input"
                    name="note"
                    placeholder="本次发布说明，可选"
                  />
                </label>

                <BatchCandidateChecklist
                  title="实体候选集"
                  description="仅展示当前未发布的实体。"
                  items={overview.batchCandidates.publish.entities}
                />
                <BatchCandidateChecklist
                  title="字段候选集"
                  description="仅展示当前未发布的字段。"
                  items={overview.batchCandidates.publish.fields}
                />
                <BatchCandidateChecklist
                  title="页面候选集"
                  description="仅展示当前未发布的页面版本。"
                  items={overview.batchCandidates.publish.pages}
                />

                <button type="submit" className="button-primary">
                  执行批量发布
                </button>
              </form>
            </div>

            <div className="version-card">
              <div className="table-cell-stack">
                <strong>批量回滚</strong>
                <span className="muted">
                  实体和字段回滚基于快照，页面回滚基于历史版本。回滚原因必填，所有动作都会写入审计日志。
                </span>
              </div>

              <form className="action-stack" action="/api/meta/batch-versions" method="post">
                <input type="hidden" name="action" value="rollback" />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <label className="form-field">
                  <span className="field-label">批量回滚原因</span>
                  <input
                    className="text-input"
                    name="reason"
                    placeholder="例如：线上配置异常，回退到稳定版本"
                    required
                  />
                </label>

                <BatchCandidateChecklist
                  title="实体快照候选集"
                  description="仅展示与当前版本不同的历史快照。"
                  items={overview.batchCandidates.rollback.entities}
                />
                <BatchCandidateChecklist
                  title="字段快照候选集"
                  description="仅展示与当前版本不同的历史快照。"
                  items={overview.batchCandidates.rollback.fields}
                />
                <BatchCandidateChecklist
                  title="页面历史版本候选集"
                  description="仅展示当前线上版本之外的历史页面版本。"
                  items={overview.batchCandidates.rollback.pages}
                />

                <button type="submit" className="button-danger">
                  执行批量回滚
                </button>
              </form>
            </div>
          </div>
        </div>
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
                          {overview.preview.page?.id !== version.id ? (
                            <Link
                              href={buildMetaHref({
                                entityId: overview.preview.entity?.id ?? version.entityId,
                                pageId: overview.preview.page?.id,
                                fieldId: overview.preview.field?.id,
                                entityDiffSnapshotId:
                                  overview.diffs.entity?.baselineId ?? undefined,
                                fieldDiffSnapshotId:
                                  overview.diffs.field?.baselineId ?? undefined,
                                pageDiffId: version.id,
                                anchor: "diff"
                              })}
                              className="button-secondary"
                            >
                              对比当前版本
                            </Link>
                          ) : null}

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
        eyebrow="治理能力"
        title="实体与字段级版本治理"
        description="实体和字段当前采用“当前配置 + 快照历史”模式治理。当前行上的版本号表示最新配置版本，历史快照用于回滚和审计。"
      >
        <div className="two-col-grid">
          <div className="version-card">
            {overview.preview.entity ? (
              <>
                <div className="version-card-header">
                  <div className="table-cell-stack">
                    <strong>
                      {overview.preview.entity.entityCode} · 当前 v{overview.preview.entity.version}
                    </strong>
                    <span className={getStatusClassName(overview.preview.entity.status)}>
                      {overview.preview.entity.status}
                    </span>
                    <span className="muted">
                      字段 {overview.preview.entityDependencies?.fieldCount ?? 0} 个 · 页面{" "}
                      {overview.preview.entityDependencies?.pageCount ?? 0} 份 · 快照{" "}
                      {overview.preview.entityDependencies?.snapshotCount ?? 0} 条
                    </span>
                  </div>
                  {canManage && overview.preview.entity.status !== "PUBLISHED" ? (
                    <form className="inline-form" action="/api/meta/entity-versions" method="post">
                      <input type="hidden" name="action" value="publish" />
                      <input type="hidden" name="entityId" value={overview.preview.entity.id} />
                      <input
                        className="text-input input-compact"
                        name="note"
                        placeholder="发布备注，可选"
                      />
                      <button type="submit" className="button-primary">
                        发布当前实体
                      </button>
                    </form>
                  ) : null}
                </div>

                {overview.entitySnapshots.length > 0 ? (
                  <div className="version-list">
                    {overview.entitySnapshots.map((snapshot) => (
                      <div key={snapshot.id} className="version-row">
                        <div className="version-row-head">
                          <div className="table-cell-stack">
                            <strong>实体快照 v{snapshot.version}</strong>
                            <span className={getStatusClassName(snapshot.status)}>{snapshot.status}</span>
                            <span className="muted">
                              {snapshot.action} · {snapshot.createdAt} · {snapshot.operatorName}
                            </span>
                            {snapshot.note ? <span className="muted">{snapshot.note}</span> : null}
                          </div>
                        </div>
                        <div className="table-cell-stack">
                          {snapshot.snapshotEntries.map((entry) => (
                            <span key={`${snapshot.id}-${entry}`} className="muted">
                              {entry}
                            </span>
                          ))}
                        </div>
                        <Link
                          href={buildMetaHref({
                            entityId: overview.preview.entity?.id ?? "",
                            pageId: overview.preview.page?.id,
                            fieldId: overview.preview.field?.id,
                            entityDiffSnapshotId: snapshot.id,
                            fieldDiffSnapshotId: overview.diffs.field?.baselineId ?? undefined,
                            pageDiffId: overview.diffs.page?.baselineId ?? undefined,
                            anchor: "diff"
                          })}
                          className="button-secondary"
                        >
                          与当前实体对比
                        </Link>
                        {canManage && snapshot.version !== overview.preview.entity?.version ? (
                          <form className="inline-form" action="/api/meta/entity-versions" method="post">
                            <input type="hidden" name="action" value="rollback" />
                            <input type="hidden" name="entityId" value={overview.preview.entity.id} />
                            <input type="hidden" name="snapshotId" value={snapshot.id} />
                            <input
                              className="text-input"
                              name="reason"
                              placeholder="实体回滚原因，必填"
                              required
                            />
                            <button type="submit" className="button-danger">
                              回滚到 v{snapshot.version}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <strong>当前实体还没有快照历史。</strong>
                    <span className="muted">保存、发布或回滚实体后，这里会出现版本记录。</span>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <strong>当前没有可治理的实体。</strong>
                <span className="muted">请先新增实体。</span>
              </div>
            )}
          </div>

          <div className="version-card">
            {overview.preview.field ? (
              <>
                <div className="version-card-header">
                  <div className="table-cell-stack">
                    <strong>
                      {overview.preview.field.fieldCode} · 当前 v{overview.preview.field.version}
                    </strong>
                    <span className={getStatusClassName(overview.preview.field.status)}>
                      {overview.preview.field.status}
                    </span>
                    <span className="muted">
                      引用页面 {overview.preview.fieldDependencies?.pageCount ?? 0} 份，其中已发布{" "}
                      {overview.preview.fieldDependencies?.publishedPageCount ?? 0} 份；规则引用{" "}
                      {overview.preview.fieldDependencies?.ruleCount ?? 0} 份，其中活跃规则{" "}
                      {overview.preview.fieldDependencies?.activeRuleCount ?? 0} 份；快照{" "}
                      {overview.preview.fieldDependencies?.snapshotCount ?? 0} 条
                    </span>
                  </div>
                  {canManage && overview.preview.field.status !== "PUBLISHED" ? (
                    <form className="inline-form" action="/api/meta/field-versions" method="post">
                      <input type="hidden" name="action" value="publish" />
                      <input type="hidden" name="fieldId" value={overview.preview.field.id} />
                      <input
                        className="text-input input-compact"
                        name="note"
                        placeholder="发布备注，可选"
                      />
                      <button type="submit" className="button-primary">
                        发布当前字段
                      </button>
                    </form>
                  ) : null}
                </div>

                <div className="table-cell-stack">
                  <strong>依赖分析</strong>
                  {overview.fieldDependencyItems.length > 0 ||
                  overview.ruleDependencyItems.length > 0 ? (
                    [...overview.fieldDependencyItems, ...overview.ruleDependencyItems].map((item) => {
                      const text =
                        "pageCode" in item
                          ? `${item.pageCode} · v${item.version} · ${item.status} · ${item.schemaPreview}`
                          : `${item.ruleCode} · v${item.version} · ${item.status} · ${item.scene} · ${item.fieldSummary} · ${item.nodeSummary}${item.isActive ? " · 活跃版本" : ""}`;

                      return (
                        <span key={item.id} className="muted">
                          {text}
                        </span>
                      );
                    })
                  ) : (
                    <span className="muted">当前字段尚未被页面或规则引用，可安全删除。</span>
                  )}
                </div>

                {overview.fieldSnapshots.length > 0 ? (
                  <div className="version-list">
                    {overview.fieldSnapshots.map((snapshot) => (
                      <div key={snapshot.id} className="version-row">
                        <div className="version-row-head">
                          <div className="table-cell-stack">
                            <strong>字段快照 v{snapshot.version}</strong>
                            <span className={getStatusClassName(snapshot.status)}>{snapshot.status}</span>
                            <span className="muted">
                              {snapshot.action} · {snapshot.createdAt} · {snapshot.operatorName}
                            </span>
                            {snapshot.note ? <span className="muted">{snapshot.note}</span> : null}
                          </div>
                        </div>
                        <div className="table-cell-stack">
                          {snapshot.snapshotEntries.map((entry) => (
                            <span key={`${snapshot.id}-${entry}`} className="muted">
                              {entry}
                            </span>
                          ))}
                        </div>
                        <Link
                          href={buildMetaHref({
                            entityId: overview.preview.entity?.id ?? "",
                            pageId: overview.preview.page?.id,
                            fieldId: overview.preview.field?.id,
                            entityDiffSnapshotId: overview.diffs.entity?.baselineId ?? undefined,
                            fieldDiffSnapshotId: snapshot.id,
                            pageDiffId: overview.diffs.page?.baselineId ?? undefined,
                            anchor: "diff"
                          })}
                          className="button-secondary"
                        >
                          与当前字段对比
                        </Link>
                        {canManage && snapshot.version !== overview.preview.field?.version ? (
                          <form className="inline-form" action="/api/meta/field-versions" method="post">
                            <input type="hidden" name="action" value="rollback" />
                            <input type="hidden" name="fieldId" value={overview.preview.field.id} />
                            <input type="hidden" name="snapshotId" value={snapshot.id} />
                            <input
                              className="text-input"
                              name="reason"
                              placeholder="字段回滚原因，必填"
                              required
                            />
                            <button type="submit" className="button-danger">
                              回滚到 v{snapshot.version}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <strong>当前字段还没有快照历史。</strong>
                    <span className="muted">保存、发布或回滚字段后，这里会出现版本记录。</span>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <strong>当前实体下没有可治理的字段。</strong>
                <span className="muted">请先新增字段。</span>
              </div>
            )}
          </div>
        </div>
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
              <th>类型 / 状态 / 版本</th>
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
                    <span className="muted">当前 v{entity.version}</span>
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
        description="字段编码建议按小写下划线命名，便于页面 Schema 和规则节点统一引用。"
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
            <label className="form-field">
              <span className="field-label">字段状态</span>
              <select className="select-input" name="status" defaultValue="DRAFT">
                {overview.options.recordStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
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
              <th>类型 / 状态 / 版本</th>
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
                    <span className={getStatusClassName(field.status)}>{field.status}</span>
                    <span
                      className={
                        field.required
                          ? "status-pill status-pill-amber"
                          : "status-pill status-pill-slate"
                      }
                    >
                      {field.required ? "必填" : "选填"}
                    </span>
                    <span className="muted">当前 v{field.version}</span>
                  </div>
                </td>
                <td className="muted">{field.schemaPreview}</td>
                <td>{field.updatedAt}</td>
                {canManage ? (
                  <td>
                    <div className="action-stack">
                      <Link
                        href={buildPreviewHref(field.entityId, overview.preview.page?.id, field.id)}
                        className="button-secondary"
                      >
                        分析依赖
                      </Link>
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
                        <select className="select-input" name="status" defaultValue={field.status}>
                          {overview.options.recordStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
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
