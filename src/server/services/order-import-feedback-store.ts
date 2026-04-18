import type { OrderImportValidationItem } from "@/server/services/order-import-service";

export type OrderImportFeedbackPayload = {
  id: string;
  createdAt: string;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  items: OrderImportValidationItem[];
};

type OrderImportFeedbackEntry = {
  expiresAt: number;
  payload: OrderImportFeedbackPayload;
};

const globalForOrderImportFeedback = globalThis as unknown as {
  orderImportFeedbackStore?: Map<string, OrderImportFeedbackEntry>;
};

function getStore() {
  if (!globalForOrderImportFeedback.orderImportFeedbackStore) {
    globalForOrderImportFeedback.orderImportFeedbackStore = new Map();
  }

  return globalForOrderImportFeedback.orderImportFeedbackStore;
}

function cleanupExpiredEntries(store: Map<string, OrderImportFeedbackEntry>) {
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

export function saveOrderImportFeedback(input: {
  summary: OrderImportFeedbackPayload["summary"];
  items: OrderImportValidationItem[];
}) {
  const store = getStore();
  cleanupExpiredEntries(store);

  const id = `import-feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload: OrderImportFeedbackPayload = {
    id,
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

export function consumeOrderImportFeedback(id: string) {
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
