import { z } from "zod";

export interface TelegramUser {
  telegramId: number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  firstSeenAt: Date;
  updatedAt: Date;
}

export const insertTelegramUserSchema = z.object({
  telegramId: z.number(),
  firstName: z.string().min(1),
  lastName: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
});

export type InsertTelegramUser = z.infer<typeof insertTelegramUserSchema>;
export type TelegramUserDoc = TelegramUser;
