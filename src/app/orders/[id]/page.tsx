import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { orderStateMap } from "@/features/orders/config/order-states";
import { requirePermission } from "@/lib/auth/guards";
import {
  getOrderActionAvailability,
  getOrderDetail,
  getWarehouseOptions
} from "@/server/services/order-service";

type PageParams = Promise<{
  id: string;
}>;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2
  }).format(amount);
}

function getStatusClassName(statusCode: keyof typeof orderStateMap) {
  const state = orderStateMap[statusCode];
  return `status-pill status-pill-${state.tone}`;
}

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const currentUser = await requirePermission("orders:view", `/orders/${id}`);
  const order = await getOrderDetail(id);

  if (!order) {
    notFound();
  }

  const pageParams = await searchParams;
  const notice = getSingleValue(pageParams.notice);
  const error = getSingleValue(pageParams.error);
  const state = orderStateMap[order.status];
  const availability = getOrderActionAvailability(order, currentUser.permissions);
  const warehouses = await getWarehouseOptions();

  return (
    <div className="page-grid">
      <header className="app-header">
        <div>
          <Link href="/orders" className="page-back-link">
            返回订单列表
          </Link>
          <h1 className="app-header-title">订单详情</h1>
          <p className="app-header-subtitle">
            当前订单号 {order.orderNo}，来源 {order.sourceChannel}。在这个页面可以查看订单明细、
            规则命中、处理日志，并直接执行审核、分仓、发货等动作。
          </p>
        </div>
        <div className="app-header-meta">
          {currentUser.name} · {currentUser.roleName}
        </div>
      </header>

      {notice ? <div className="alert-banner alert-banner-success">{notice}</div> : null}
      {error ? <div className="alert-banner alert-banner-error">{error}</div> : null}

      <section className="surface-card detail-hero">
        <div className="detail-hero-main">
          <div>
            <span className="eyebrow">订单总览</span>
            <h2>{order.orderNo}</h2>
            <p className="muted">
              外部单号 {order.sourceNo} · {order.sourceChannel} · {order.createdAt}
            </p>
          </div>

          <div className="detail-status-row">
            <span className={getStatusClassName(order.status)}>{state.name}</span>
            {order.isAbnormal ? <span className="status-pill status-pill-red">异常订单</span> : null}
            {order.isLocked ? <span className="status-pill status-pill-slate">锁单中</span> : null}
          </div>
        </div>

        <div className="chip-row">
          {order.tags.map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
        </div>
      </section>

      <div className="stats-grid">
        <MetricCard
          label="订单金额"
          value={formatAmount(order.amountSummary.paidAmount)}
          hint="包含商品金额、优惠和运费后的实付金额。"
        />
        <MetricCard
          label="商品行数"
          value={`${order.items.length} 行`}
          hint="当前订单商品明细数量。"
        />
        <MetricCard
          label="规则命中"
          value={`${order.ruleHits.length} 次`}
          hint="详情页展示命中的规则版本和执行路径。"
        />
        <MetricCard
          label="处理日志"
          value={`${order.logs.length} 条`}
          hint="人工、系统和规则操作都会在这里留痕。"
        />
      </div>

      <div className="two-col-grid">
        <SectionCard
          eyebrow="基础信息"
          title="客户与收货信息"
          description="用于确认支付、客户等级、收件地址和留言信息。"
        >
          <div className="kv-grid">
            <div>
              <strong>客户姓名</strong>
              <span>{order.customerName}</span>
            </div>
            <div>
              <strong>手机号</strong>
              <span>{order.phone}</span>
            </div>
            <div>
              <strong>客户等级</strong>
              <span>{order.customerLevel}</span>
            </div>
            <div>
              <strong>支付状态</strong>
              <span>{order.paymentStatus}</span>
            </div>
            <div>
              <strong>收件人</strong>
              <span>{order.receiver.receiverName}</span>
            </div>
            <div>
              <strong>收货电话</strong>
              <span>{order.receiver.phone}</span>
            </div>
            <div className="kv-grid-full">
              <strong>收货地址</strong>
              <span>
                {order.receiver.province}
                {order.receiver.city}
                {order.receiver.district}
                {order.receiver.address}
              </span>
            </div>
            <div className="kv-grid-full">
              <strong>买家留言</strong>
              <span>{order.notes.buyer || "无"}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="履约信息"
          title="仓配与金额"
          description="订单当前履约节点、仓库分配、物流信息和金额结构。"
        >
          <div className="kv-grid">
            <div>
              <strong>审核模式</strong>
              <span>{order.reviewMode}</span>
            </div>
            <div>
              <strong>当前仓库</strong>
              <span>{order.warehouseName || "待分配"}</span>
            </div>
            <div>
              <strong>商品金额</strong>
              <span>{formatAmount(order.amountSummary.goodsAmount)}</span>
            </div>
            <div>
              <strong>优惠金额</strong>
              <span>{formatAmount(order.amountSummary.discountAmount)}</span>
            </div>
            <div>
              <strong>运费</strong>
              <span>{formatAmount(order.amountSummary.shippingFee)}</span>
            </div>
            <div>
              <strong>实付金额</strong>
              <span>{formatAmount(order.amountSummary.paidAmount)}</span>
            </div>
            <div className="kv-grid-full">
              <strong>物流信息</strong>
              <span>
                {order.shipment
                  ? `${order.shipment.companyName} / ${order.shipment.trackingNo} / ${order.shipment.shippedAt ?? "待回写"}`
                  : "尚未发货"}
              </span>
            </div>
            <div className="kv-grid-full">
              <strong>系统备注</strong>
              <span>{order.notes.system || "无"}</span>
            </div>
            <div className="kv-grid-full">
              <strong>客服备注</strong>
              <span>{order.notes.service || "无"}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="操作面板"
        title="状态流转与人工处理"
        description="动作会直接写入数据库中的订单、物流、操作日志和审计日志。"
      >
        <div className="operation-grid">
          {availability.canApproveReview ? (
            <form className="operation-card" action={`/api/orders/${order.id}/actions`} method="post">
              <input type="hidden" name="action" value="approve-review" />
              <input type="hidden" name="redirectTo" value={`/orders/${order.id}`} />
              <span className="bullet-title">审核通过</span>
              <p className="muted">适用于待审核或人工审核且未锁单的订单。</p>
              <input className="text-input" name="reason" placeholder="可选：填写审核通过说明" />
              <button type="submit" className="button-primary">
                执行审核通过
              </button>
            </form>
          ) : null}

          {availability.canRejectReview ? (
            <form className="operation-card" action={`/api/orders/${order.id}/actions`} method="post">
              <input type="hidden" name="action" value="reject-review" />
              <input type="hidden" name="redirectTo" value={`/orders/${order.id}`} />
              <span className="bullet-title">审核驳回</span>
              <p className="muted">驳回后订单会进入已取消，并写入人工处理日志。</p>
              <input
                className="text-input"
                name="reason"
                placeholder="请填写驳回原因"
                required
              />
              <button type="submit" className="button-danger">
                执行审核驳回
              </button>
            </form>
          ) : null}

          {availability.canAssignWarehouse ? (
            <form className="operation-card" action={`/api/orders/${order.id}/actions`} method="post">
              <input type="hidden" name="action" value="assign-warehouse" />
              <input type="hidden" name="redirectTo" value={`/orders/${order.id}`} />
              <span className="bullet-title">手工分仓</span>
              <p className="muted">当前状态允许手工分配仓库，成功后将流转到待发货。</p>
              <select className="select-input" name="warehouseCode" defaultValue="">
                <option value="" disabled>
                  请选择仓库
                </option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.code} value={warehouse.code}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <input
                className="text-input"
                name="reason"
                placeholder="请填写手工分仓原因"
                required
              />
              <button type="submit" className="button-primary">
                执行分仓
              </button>
            </form>
          ) : null}

          {availability.canShip ? (
            <form className="operation-card" action={`/api/orders/${order.id}/actions`} method="post">
              <input type="hidden" name="action" value="ship-order" />
              <input type="hidden" name="redirectTo" value={`/orders/${order.id}`} />
              <span className="bullet-title">执行发货</span>
              <p className="muted">录入物流公司和物流单号后，订单将进入已发货。</p>
              <input className="text-input" name="shippingCompany" placeholder="物流公司，例如 顺丰速运" />
              <input className="text-input" name="trackingNo" placeholder="物流单号" />
              <input className="text-input" name="reason" placeholder="可选：填写发货备注" />
              <button type="submit" className="button-primary">
                执行发货
              </button>
            </form>
          ) : null}

          {availability.canLock ? (
            <form className="operation-card" action={`/api/orders/${order.id}/actions`} method="post">
              <input type="hidden" name="action" value="lock-order" />
              <input type="hidden" name="redirectTo" value={`/orders/${order.id}`} />
              <span className="bullet-title">锁单</span>
              <p className="muted">锁单后将阻断审核通过、分仓和发货等后续动作。</p>
              <input
                className="text-input"
                name="reason"
                placeholder="请填写锁单原因"
                required
              />
              <button type="submit" className="button-secondary">
                执行锁单
              </button>
            </form>
          ) : null}

          {availability.canUnlock ? (
            <form className="operation-card" action={`/api/orders/${order.id}/actions`} method="post">
              <input type="hidden" name="action" value="unlock-order" />
              <input type="hidden" name="redirectTo" value={`/orders/${order.id}`} />
              <span className="bullet-title">解除锁单</span>
              <p className="muted">解除锁单后，订单可恢复审核、分仓或发货操作。</p>
              <input
                className="text-input"
                name="reason"
                placeholder="请填写解锁说明"
                required
              />
              <button type="submit" className="button-secondary">
                执行解锁
              </button>
            </form>
          ) : null}

          {!Object.values(availability).some(Boolean) ? (
            <div className="operation-card">
              <span className="bullet-title">当前没有可执行动作</span>
              <p className="muted">
                可能是当前订单状态已完成该阶段处理，或者当前登录角色没有对应权限。
              </p>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="商品明细"
        title="订单商品"
        description="后续这里可以继续接 SKU 详情、库存联动和售后入口。"
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>商品名称</th>
              <th>规格</th>
              <th>数量</th>
              <th>单价</th>
              <th>小计</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.skuId}</td>
                <td>{item.skuName}</td>
                <td>{item.spec}</td>
                <td>{item.quantity}</td>
                <td>{formatAmount(item.price)}</td>
                <td>{formatAmount(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <div className="two-col-grid">
        <SectionCard
          eyebrow="规则记录"
          title="规则命中"
          description="用于说明这单为什么被审核通过、锁单或分到指定仓库。"
        >
          <ul className="timeline-list">
            {order.ruleHits.map((item) => (
              <li key={item.id}>
                <span className="timeline-title">
                  {item.ruleName} · {item.version}
                </span>
                <span className="muted">{item.path}</span>
                <br />
                <span>{item.result}</span>
                <br />
                <span className="muted">{item.executedAt}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          eyebrow="处理日志"
          title="人工 / 系统 / 规则日志"
          description="每次状态流转都会落到数据库日志中，后续可继续升级为完整审计中心。"
        >
          <ul className="timeline-list">
            {order.logs.map((item) => (
              <li key={item.id}>
                <span className="timeline-title">
                  {item.title} · {item.operator}
                </span>
                <span>{item.detail}</span>
                <br />
                <span className="muted">
                  {item.type} · {item.createdAt}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
