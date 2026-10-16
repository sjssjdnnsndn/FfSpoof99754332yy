import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  bigint,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { telegramUsers } from "./telegram-users";

export const cryptoPaymentMethods = pgTable("crypto_payment_methods", {
  currencyCode: text("currency_code").primaryKey(),
  network: text("network").notNull(),
  address: text("address").notNull(),
  updatedBy: bigint("updated_by", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const topUpQuotes = pgTable("top_up_quotes", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" })
    .notNull()
    .references(() => telegramUsers.telegramId),
  currencyCode: text("currency_code").notNull(),
  network: text("network").notNull(),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  exchangeRateUsd: numeric("exchange_rate_usd", {
    precision: 24,
    scale: 10,
  }).notNull(),
  cryptoAmount: numeric("crypto_amount", {
    precision: 32,
    scale: 12,
  }).notNull(),
  depositAddress: text("deposit_address").notNull(),
  status: text("status").notNull().default("quoted"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const insertCryptoPaymentMethodSchema = createInsertSchema(
  cryptoPaymentMethods,
).omit({ updatedAt: true });
export const insertTopUpQuoteSchema = createInsertSchema(topUpQuotes).omit({
  id: true,
  createdAt: true,
});

export type InsertCryptoPaymentMethod = z.infer<
  typeof insertCryptoPaymentMethodSchema
>;
export type InsertTopUpQuote = z.infer<typeof insertTopUpQuoteSchema>;
export type CryptoPaymentMethod = typeof cryptoPaymentMethods.$inferSelect;
export type TopUpQuote = typeof topUpQuotes.$inferSelect;
