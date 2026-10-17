import {
  cryptoCurrencies,
  findCryptoCurrency,
  type CryptoCode,
} from "./telegram-crypto-currencies";
import type { BotScreen, InlineButton } from "./telegram-bot-screens";

interface QuoteForScreen {
  currency: string;
  network: string;
  amountUsd: number;
  amountCrypto: string;
  rateUsd: number;
  address: string;
}

const divider = "━━━━━━━━━━━━━━━━━━━━";
const menuButton: InlineButton = { text: "🏠 Menu", callback_data: "menu" };

function screen(text: string, rows: InlineButton[][]): BotScreen {
  return { text, reply_markup: { inline_keyboard: rows } };
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function exchangeRate(amount: number): string {
  const decimalPlaces = amount >= 100 ? 2 : amount >= 1 ? 4 : 8;
  return `$${amount.toFixed(decimalPlaces)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function topUpScreen(): BotScreen {
  return screen(
    [
      "<b>💵 Top up</b>",
      divider,
      "💰 Balance ▹ $0.00",
      "🕒 Last time ▹",
      "💵 Amounts ▹ $50 to $10,000",
      divider,
      "",
      "💡 <b>Pick an amount</b>",
      "Tap one of the amounts, or Custom amount to type your own. Next, choose a currency.",
    ].join("\n"),
    [
      [
        { text: "💵 $80", callback_data: "topup_80" },
        { text: "💵 $150", callback_data: "topup_150" },
      ],
      [
        { text: "💵 $200", callback_data: "topup_200" },
        { text: "💵 $500", callback_data: "topup_500" },
      ],
      [{ text: "✏️ Custom amount", callback_data: "topup_custom" }],
      [
        { text: "◀️ Wallet", callback_data: "wallet" },
        menuButton,
      ],
    ],
  );
}

export function customTopUpAmountScreen(): BotScreen {
  return screen(
    [
      "<b>✏️ Custom amount</b>",
      divider,
      "Enter an amount from $50 to $10,000.",
      "You can include up to two decimal places.",
    ].join("\n"),
    [
      [{ text: "❌ Cancel", callback_data: "topup_cancel" }],
      [menuButton],
    ],
  );
}

export function invalidTopUpAmountScreen(): BotScreen {
  return screen(
    [
      "<b>❌ Amount not valid</b>",
      divider,
      "Enter an amount from $50 to $10,000, with up to two decimal places.",
    ].join("\n"),
    [
      [{ text: "✏️ Try again", callback_data: "topup_custom" }],
      [
        { text: "💰 Wallet", callback_data: "wallet" },
        menuButton,
      ],
    ],
  );
}

export function cryptoCurrencySelectionScreen(amountUsd: number): BotScreen {
  const currencyRows: InlineButton[][] = [];
  for (let index = 0; index < cryptoCurrencies.length; index += 2) {
    currencyRows.push(
      cryptoCurrencies.slice(index, index + 2).map((currency) => ({
        text: currency.label,
        callback_data: `currency_${currency.code}`,
      })),
    );
  }

  return screen(
    [
      "<b>💰 Top-up</b>",
      "Type or select the amount you’d like to top-up balance.",
      "",
      "<i>Minimum amount: $50</i>",
      `Selected amount: ${money(amountUsd)}`,
    ].join("\n"),
    [
      ...currencyRows.slice(0, 3),
      [
        currencyRows[3]?.[0] ?? {
          text: "TON",
          callback_data: "currency_TON",
        },
        { text: "👉 Back", callback_data: "topup_back" },
      ],
    ],
  );
}

export function topUpAddressScreen(quote: QuoteForScreen): BotScreen {
  const currency = findCryptoCurrency(
    quote.currency === "USDT (TRC20)" ? "USDT_TRC20" : quote.currency,
  );
  const ticker = currency?.paymentMethod ?? quote.currency;
  const address = escapeHtml(quote.address);

  return screen(
    [
      "<b>💰 Top-up</b>",
      "",
      `Payment method: ${escapeHtml(quote.currency)}`,
      `Network: ${escapeHtml(quote.network)}`,
      `Amount: ${money(quote.amountUsd)}`,
      "",
      "Send to the address below",
      `${quote.amountCrypto} ${escapeHtml(ticker)} (at the exchange rate of ${exchangeRate(quote.rateUsd)}):`,
      "",
      `<code>${address}</code>`,
      "",
      "<i>The quote is valid for 1 hour. The actual amount may differ due to changes in the current exchange rate.</i>",
    ].join("\n"),
    [[{ text: "👉 Back", callback_data: "currency_back" }]],
  );
}

export function addressNotConfiguredScreen(code: CryptoCode): BotScreen {
  const currency = findCryptoCurrency(code);
  return screen(
    [
      `<b>⚠️ ${currency?.label ?? code} address not set</b>`,
      divider,
      "The admin hasn't added a deposit address for this network yet.",
      "Please choose another currency or try again later.",
    ].join("\n"),
    [
      [{ text: "👉 Back", callback_data: "currency_back" }],
      [menuButton],
    ],
  );
}

export function exchangeRateUnavailableScreen(): BotScreen {
  return screen(
    [
      "<b>⚠️ Exchange rate unavailable</b>",
      divider,
      "No address instructions were created. Please try again shortly.",
    ].join("\n"),
    [
      [{ text: "🔄 Try again", callback_data: "currency_back" }],
      [menuButton],
    ],
  );
}

export function topUpQuoteUnavailableScreen(): BotScreen {
  return screen(
    [
      "<b>⚠️ Top-up quote unavailable</b>",
      divider,
      "No payment instructions were created. Please try again.",
    ].join("\n"),
    [
      [{ text: "💵 Pick another amount", callback_data: "top_up" }],
      [menuButton],
    ],
  );
}
