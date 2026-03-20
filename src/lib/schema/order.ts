import { z } from "zod";

export const orderStatusSchema = z.enum([
  "PENDING_REVIEW",
  "MANUAL_REVIEW",
  "PENDING_WAREHOUSE",
  "PENDING_SHIPMENT",
  "SHIPPED",
  "SIGNED",
  "COMPLETED",
  "CANCELED",
  "AFTER_SALE"
]);

export const orderItemSchema = z.object({
  skuId: z.string().min(1),
  skuName: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative()
});

export const orderSchema = z.object({
  orderNo: z.string().min(1),
  sourceChannel: z.string().min(1),
  status: orderStatusSchema,
  customerName: z.string().min(1),
  phone: z.string().min(6),
  amount: z.number().nonnegative(),
  items: z.array(orderItemSchema).min(1)
});

export type OrderInput = z.infer<typeof orderSchema>;
