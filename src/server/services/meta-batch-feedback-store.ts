import type {
  MetaBatchVersionAction,
  MetaBatchVersionItemResult
} from "@/server/services/meta-service";

export type MetaBatchFeedbackPayload = {
  id: string;
  action: MetaBatchVersionAction;
  createdAt: string;
  summary: {
    total: number;
    successCount: number;
    failedCount: number;
  };
  items: MetaBatchVersionItemResult[];
};

type MetaBatchFeedbackEntry = {
  expiresAt: number;
  payload: MetaBatchFeedbackPayload;
};

const globalForMetaBatchFeedback = globalThis as unknown as {
  metaBatchFeedbackStore?: Map<string, MetaBatchFeedbackEntry>;
};

function getStore() {
  if (!globalForMetaBatchFeedback.metaBatchFeedbackStore) {
    globalForMetaBatchFeedback.metaBatchFeedbackStore = new Map();
  }

  return globalForMetaBatchFeedback.metaBatchFeedbackStore;
}

function cleanupExpiredEntries(store: Map<string, MetaBatchFeedbackEntry>) {
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

export function saveMetaBatchFeedback(input: {
  action: MetaBatchVersionAction;
  summary: MetaBatchFeedbackPayload["summary"];
  items: MetaBatchVersionItemResult[];
}) {
  const store = getStore();
  cleanupExpiredEntries(store);

  const id = `meta-batch-feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload: MetaBatchFeedbackPayload = {
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

export function consumeMetaBatchFeedback(id: string) {
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
