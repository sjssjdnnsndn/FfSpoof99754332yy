import { createInsertSchema } from "drizzle-zod";
import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const telegramUsers = pgTable("telegram_users", {
  telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  username: text("username"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTelegramUserSchema = createInsertSchema(telegramUsers).omit({
  firstSeenAt: true,
  updatedAt: true,
});

export type InsertTelegramUser = z.infer<typeof insertTelegramUserSchema>;
export type TelegramUser = typeof telegramUsers.$inferSelect;
