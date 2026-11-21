import { z } from "zod";

export interface TelegramBotSetting {
  key: string;
  value: string;
  updatedBy: number;
  updatedAt: Date;
}

export const insertTelegramBotSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  updatedBy: z.number(),
});

export type InsertTelegramBotSetting = z.infer<typeof insertTelegramBotSettingSchema>;
export type TelegramBotSettingDoc = TelegramBotSetting;
