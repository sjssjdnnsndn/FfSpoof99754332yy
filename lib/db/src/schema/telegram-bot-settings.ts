import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const telegramBotSettings = pgTable("telegram_bot_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: bigint("updated_by", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTelegramBotSettingSchema = createInsertSchema(
  telegramBotSettings,
).omit({ updatedAt: true });

export type InsertTelegramBotSetting = z.infer<
  typeof insertTelegramBotSettingSchema
>;
export type TelegramBotSetting = typeof telegramBotSettings.$inferSelect;
