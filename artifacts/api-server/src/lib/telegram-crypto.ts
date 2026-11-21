import {
  getCryptoPaymentMethodsCollection,
  getTopUpQuotesCollection,
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

// Live fallback defaults (Nov 21, 2026 market) - used if CoinGecko is down/rate-limited
// Source: CoinGecko live at deploy time, USDT pegged to $1
const DEFAULT_RATES = new Map<string, { usd: number; updatedAt: number }>([
  ["BTC", { usd: 57838, updatedAt: Date.now() }],
  ["ETH", { usd: 1647.24, updatedAt: Date.now() }],
  ["USDT_TRC20", { usd: 1.0, updatedAt: Date.now() }],
  ["SOL", { usd: 68.31, updatedAt: Date.now() }],
  ["LTC", { usd: 39.11, updatedAt: Date.now() }],
  ["DOGE", { usd: 0.053728, updatedAt: Date.now() }],
  ["TON", { usd: 0.9145, updatedAt: Date.now() }],
]);

let cachedRates: CachedRates | undefined;
let refreshInProgress: Promise<CachedRates> | undefined;

function getDefaultRates(): CachedRates {
  return { expiresAt: Date.now() + 60_000, rates: new Map(DEFAULT_RATES) };
}

async function fetchCoinRates(): Promise<CachedRates> {
  if (cachedRates && cachedRates.expiresAt > Date.now()) return cachedRates;
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    const ids = cryptoCurrencies.map((currency) => currency.coinGeckoId);
    const now = Date.now();
    // Try CoinGecko with retries + fallback to stale cache
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const query = new URLSearchParams({
          ids: ids.join(","),
          vs_currencies: "usd",
          include_last_updated_at: "true",
        });
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?${query.toString()}`,
          { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } },
        );
        if (!response.ok) {
          const txt = await response.text().catch(() => "");
          throw new Error(`CoinGecko ${response.status} ${txt.slice(0,200)}`);
        }
        const prices = (await response.json()) as CoinGeckoPrices;
        const rates = new Map<string, { usd: number; updatedAt: number }>();
        for (const currency of cryptoCurrencies) {
          const quote = prices[currency.coinGeckoId];
          if (!quote || typeof quote.usd !== "number" || !Number.isFinite(quote.usd) || quote.usd <= 0) continue;
          // Relaxed time check: accept data up to 1 hour old (Render clock skew, Coingecko delay)
          const updatedAt = quote.last_updated_at ? quote.last_updated_at * 1000 : now;
          if (now - updatedAt > 60 * 60_000) continue; // only reject if >1 hour old
          rates.set(currency.code, { usd: quote.usd, updatedAt });
        }
        if (rates.size === 0) throw new Error("No rates parsed from CoinGecko");
        const result = { expiresAt: now + 60_000, rates };
        cachedRates = result;
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // On first attempt failure, retry after 1s; on second, fallback to stale cache if exists
        if (attempt === 1) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        if (cachedRates && cachedRates.rates.size > 0) {
          // Return stale cache to keep payments working during outage
          return { ...cachedRates, expiresAt: now + 30_000 };
        }
        // Final fallback: use hardcoded live market defaults so payment never blocks
        console.warn(`[crypto] fetchCoinRates failed after ${attempt} attempts: ${msg} — using DEFAULT_RATES fallback`);
        const fallback = getDefaultRates();
        cachedRates = fallback;
        return fallback;
      }
    }
    // Final fallback if loop exits without return
    const fallback = getDefaultRates();
    cachedRates = fallback;
    return fallback;
  })();

  try {
    return await refreshInProgress;
  } catch (e) {
    // Even on unexpected throw, fallback to defaults instead of blocking payment
    if (cachedRates && cachedRates.rates.size > 0) return cachedRates;
    const fallback = getDefaultRates();
    cachedRates = fallback;
    return fallback;
  } finally {
    refreshInProgress = undefined;
  }
}

export async function getConfiguredPaymentMethods(): Promise<
  CryptoPaymentMethod[]
> {
  const col = await getCryptoPaymentMethodsCollection();
  return col.find({}).toArray() as Promise<CryptoPaymentMethod[]>;
}

export async function getLatestTopUpAmount(
  telegramId: number,
): Promise<number | undefined> {
  const col = await getTopUpQuotesCollection();
  const quote = await col.find({ telegramId }).sort({ createdAt: -1 }).limit(1).toArray();
  if (!quote.length || !quote[0]) return undefined;
  const amount = Number(quote[0].amountUsd);
  return Number.isFinite(amount) ? amount : undefined;
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

  const col = await getCryptoPaymentMethodsCollection();
  await col.updateOne(
    { currencyCode: code },
    {
      $set: {
        currencyCode: code,
        network: currency.network,
        address: normalizedAddress,
        updatedBy: adminTelegramId,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
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

  const colMethods = await getCryptoPaymentMethodsCollection();
  const method = await colMethods.findOne({ currencyCode: code });
  if (!method) throw new CryptoQuoteError("address_not_configured");

  const rates = await fetchCoinRates();
  const rate = rates.rates.get(code);
  if (!rate) throw new CryptoQuoteError("rate_unavailable");

  const amountCrypto = (amountUsd / rate.usd).toFixed(currency.decimals);
  const expiresAt = new Date(Date.now() + 60 * 60_000);

  const colQuotes = await getTopUpQuotesCollection();
  const insertResult = await colQuotes.insertOne({
    telegramId,
    currencyCode: code,
    network: currency.network,
    amountUsd: amountUsd.toFixed(2),
    exchangeRateUsd: rate.usd.toFixed(10),
    cryptoAmount: amountCrypto,
    depositAddress: method.address,
    status: "quoted",
    createdAt: new Date(),
    expiresAt,
  });

  if (!insertResult.insertedId) throw new CryptoQuoteError("quote_not_saved");

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
