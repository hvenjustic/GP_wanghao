import type { BatchOrderActionCode, BulkOrderActionItemResult } from "@/server/services/order-service";

export type OrderBatchFeedbackPayload = {
  id: string;
  action: BatchOrderActionCode;
  createdAt: string;
  summary: {
    total: number;
    successCount: number;
    failedCount: number;
  };
  items: BulkOrderActionItemResult[];
};

type OrderBatchFeedbackEntry = {
  expiresAt: number;
  payload: OrderBatchFeedbackPayload;
};

const globalForOrderBatchFeedback = globalThis as unknown as {
  orderBatchFeedbackStore?: Map<string, OrderBatchFeedbackEntry>;
};

function getStore() {
  if (!globalForOrderBatchFeedback.orderBatchFeedbackStore) {
    globalForOrderBatchFeedback.orderBatchFeedbackStore = new Map();
  }

  return globalForOrderBatchFeedback.orderBatchFeedbackStore;
}

function cleanupExpiredEntries(store: Map<string, OrderBatchFeedbackEntry>) {
  const now = Date.now();

  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function formatCreatedAt() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function saveOrderBatchFeedback(input: {
  action: BatchOrderActionCode;
  summary: OrderBatchFeedbackPayload["summary"];
  items: BulkOrderActionItemResult[];
}) {
  const store = getStore();
  cleanupExpiredEntries(store);

  const id = `batch-feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload: OrderBatchFeedbackPayload = {
    id,
    action: input.action,
    createdAt: formatCreatedAt(),
    summary: input.summary,
    items: input.items
  };

  store.set(id, {
    payload,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  return id;
}

export function consumeOrderBatchFeedback(id: string) {
  if (!id) {
    return null;
  }

  const store = getStore();
  cleanupExpiredEntries(store);
  const entry = store.get(id) ?? null;

  if (!entry) {
    return null;
  }

  store.delete(id);
  return entry.payload;
}
