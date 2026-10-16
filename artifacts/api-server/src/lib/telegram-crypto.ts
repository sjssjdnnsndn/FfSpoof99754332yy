import { eq } from "drizzle-orm";
import {
  cryptoPaymentMethods,
  db,
  topUpQuotes,
} from "@workspace/db";
import type { CryptoPaymentMethod } from "@workspace/db";
import {
  cryptoCurrencies,
  findCryptoCurrency,
  isValidCryptoAddress,
  type CryptoCode,
} from "./telegram-crypto-currencies";

interface CoinGeckoPrice {
  usd?: number;
  last_updated_at?: number;
}

type CoinGeckoPrices = Record<string, CoinGeckoPrice>;

interface CachedRates {
  expiresAt: number;
  rates: Map<string, { usd: number; updatedAt: number }>;
}

export class CryptoQuoteError extends Error {
  constructor(
    readonly reason:
      | "invalid_amount"
      | "address_not_configured"
      | "rate_unavailable"
      | "quote_not_saved",
  ) {
    super(reason);
    this.name = "CryptoQuoteError";
  }
}

let cachedRates: CachedRates | undefined;
let refreshInProgress: Promise<CachedRates> | undefined;

async function fetchCoinRates(): Promise<CachedRates> {
  if (cachedRates && cachedRates.expiresAt > Date.now()) return cachedRates;
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    const ids = cryptoCurrencies.map((currency) => currency.coinGeckoId);
    const query = new URLSearchParams({
      ids: ids.join(","),
      vs_currencies: "usd",
      include_last_updated_at: "true",
    });
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?${query.toString()}`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (!response.ok) {
      throw new CryptoQuoteError("rate_unavailable");
    }

    const prices = (await response.json()) as CoinGeckoPrices;
    const rates = new Map<string, { usd: number; updatedAt: number }>();
    const now = Date.now();

    for (const currency of cryptoCurrencies) {
      const quote = prices[currency.coinGeckoId];
      if (
        !quote ||
        typeof quote.usd !== "number" ||
        !Number.isFinite(quote.usd) ||
        quote.usd <= 0
      ) {
        continue;
      }

      const updatedAt = quote.last_updated_at
        ? quote.last_updated_at * 1000
        : now;
      if (now - updatedAt > 5 * 60_000 || updatedAt - now > 2 * 60_000) {
        continue;
      }

      rates.set(currency.code, { usd: quote.usd, updatedAt });
    }

    const result = { expiresAt: now + 60_000, rates };
    cachedRates = result;
    return result;
  })();

  try {
    return await refreshInProgress;
  } catch {
    throw new CryptoQuoteError("rate_unavailable");
  } finally {
    refreshInProgress = undefined;
  }
}

export async function getConfiguredPaymentMethods(): Promise<
  CryptoPaymentMethod[]
> {
  return db.select().from(cryptoPaymentMethods);
}

export async function saveCryptoPaymentAddress(
  code: CryptoCode,
  address: string,
  adminTelegramId: number,
): Promise<void> {
  const currency = findCryptoCurrency(code);
  const normalizedAddress = address.trim();
  if (!currency || !isValidCryptoAddress(code, normalizedAddress)) {
    throw new Error("invalid_crypto_address");
  }

  await db
    .insert(cryptoPaymentMethods)
    .values({
      currencyCode: code,
      network: currency.network,
      address: normalizedAddress,
      updatedBy: adminTelegramId,
    })
    .onConflictDoUpdate({
      target: cryptoPaymentMethods.currencyCode,
      set: {
        network: currency.network,
        address: normalizedAddress,
        updatedBy: adminTelegramId,
        updatedAt: new Date(),
      },
    });
}

export async function createTopUpQuote(
  telegramId: number,
  amountUsd: number,
  code: CryptoCode,
): Promise<{
  currency: string;
  network: string;
  amountUsd: number;
  amountCrypto: string;
  rateUsd: number;
  address: string;
  expiresAt: Date;
}> {
  if (!Number.isFinite(amountUsd) || amountUsd < 50 || amountUsd > 10_000) {
    throw new CryptoQuoteError("invalid_amount");
  }

  const currency = findCryptoCurrency(code);
  if (!currency) throw new CryptoQuoteError("rate_unavailable");

  const [method] = await db
    .select()
    .from(cryptoPaymentMethods)
    .where(eq(cryptoPaymentMethods.currencyCode, code))
    .limit(1);
  if (!method) throw new CryptoQuoteError("address_not_configured");

  const rates = await fetchCoinRates();
  const rate = rates.rates.get(code);
  if (!rate) throw new CryptoQuoteError("rate_unavailable");

  const amountCrypto = (amountUsd / rate.usd).toFixed(currency.decimals);
  const expiresAt = new Date(Date.now() + 60 * 60_000);
  const [quote] = await db
    .insert(topUpQuotes)
    .values({
      telegramId,
      currencyCode: code,
      network: currency.network,
      amountUsd: amountUsd.toFixed(2),
      exchangeRateUsd: rate.usd.toFixed(10),
      cryptoAmount: amountCrypto,
      depositAddress: method.address,
      status: "quoted",
      expiresAt,
    })
    .returning();

  if (!quote) throw new CryptoQuoteError("quote_not_saved");

  return {
    currency: currency.paymentMethod,
    network: currency.network,
    amountUsd,
    amountCrypto,
    rateUsd: rate.usd,
    address: method.address,
    expiresAt,
  };
}
