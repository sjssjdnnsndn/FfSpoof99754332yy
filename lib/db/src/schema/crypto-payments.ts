import { z } from "zod";

export interface CryptoPaymentMethod {
  currencyCode: string;
  network: string;
  address: string;
  updatedBy: number;
  updatedAt: Date;
}

export interface TopUpQuote {
  _id?: any;
  telegramId: number;
  currencyCode: string;
  network: string;
  amountUsd: string;
  exchangeRateUsd: string;
  cryptoAmount: string;
  depositAddress: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}

export const insertCryptoPaymentMethodSchema = z.object({
  currencyCode: z.string().min(1),
  network: z.string().min(1),
  address: z.string().min(1),
  updatedBy: z.number(),
});

export const insertTopUpQuoteSchema = z.object({
  telegramId: z.number(),
  currencyCode: z.string().min(1),
  network: z.string().min(1),
  amountUsd: z.string(),
  exchangeRateUsd: z.string(),
  cryptoAmount: z.string(),
  depositAddress: z.string().min(1),
  status: z.string().optional().default("quoted"),
  expiresAt: z.date(),
});

export type InsertCryptoPaymentMethod = z.infer<typeof insertCryptoPaymentMethodSchema>;
export type InsertTopUpQuote = z.infer<typeof insertTopUpQuoteSchema>;
export type CryptoPaymentMethodDoc = CryptoPaymentMethod;
export type TopUpQuoteDoc = TopUpQuote;
