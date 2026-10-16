export const cryptoCurrencies = [
  {
    code: "BTC",
    label: "BTC",
    paymentMethod: "BTC",
    network: "Bitcoin network",
    coinGeckoId: "bitcoin",
    decimals: 8,
  },
  {
    code: "ETH",
    label: "ETH",
    paymentMethod: "ETH",
    network: "Ethereum network",
    coinGeckoId: "ethereum",
    decimals: 8,
  },
  {
    code: "USDT_TRC20",
    label: "USDT (TRC20)",
    paymentMethod: "USDT (TRC20)",
    network: "TRON network (TRC20)",
    coinGeckoId: "tether",
    decimals: 6,
  },
  {
    code: "SOL",
    label: "SOL",
    paymentMethod: "SOL",
    network: "Solana network",
    coinGeckoId: "solana",
    decimals: 8,
  },
  {
    code: "LTC",
    label: "LTC",
    paymentMethod: "LTC",
    network: "Litecoin network",
    coinGeckoId: "litecoin",
    decimals: 8,
  },
  {
    code: "DOGE",
    label: "DOGE",
    paymentMethod: "DOGE",
    network: "Dogecoin network",
    coinGeckoId: "dogecoin",
    decimals: 8,
  },
  {
    code: "TON",
    label: "TON",
    paymentMethod: "TON",
    network: "TON network",
    coinGeckoId: "the-open-network",
    decimals: 9,
  },
] as const;

export type CryptoCurrency = (typeof cryptoCurrencies)[number];
export type CryptoCode = CryptoCurrency["code"];

export function findCryptoCurrency(code: string): CryptoCurrency | undefined {
  return cryptoCurrencies.find((currency) => currency.code === code);
}

export function isCryptoCode(code: string): code is CryptoCode {
  return findCryptoCurrency(code) !== undefined;
}

export function isValidCryptoAddress(
  code: CryptoCode,
  address: string,
): boolean {
  if (!address || address.length > 120 || /\s/.test(address)) return false;

  switch (code) {
    case "BTC":
      return /^(?:bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(
        address,
      );
    case "ETH":
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case "USDT_TRC20":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    case "SOL":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    case "LTC":
      return /^(?:[LM3][1-9A-HJ-NP-Za-km-z]{25,33}|ltc1[ac-hj-np-z02-9]{11,71})$/i.test(
        address,
      );
    case "DOGE":
      return /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
    case "TON":
      return /^(?:(?:EQ|UQ)[A-Za-z0-9_-]{46}|0:[a-fA-F0-9]{64})$/.test(
        address,
      );
  }
}
