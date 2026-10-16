import type { TelegramUser as TelegramUserProfile } from "@workspace/db";

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface BotScreen {
  text: string;
  reply_markup: {
    inline_keyboard: InlineButton[][];
  };
}

export interface PlanOption {
  id: string;
  title: string;
  price: number;
  topUpLabel: string;
}

export const plans: PlanOption[] = [
  { id: "plan_1_day", title: "1-Day", price: 80, topUpLabel: "$80.00" },
  { id: "plan_2_day", title: "2-Day", price: 150, topUpLabel: "$150.00" },
  { id: "plan_7_day", title: "7-Day", price: 450, topUpLabel: "$450.00" },
];

const divider = "━━━━━━━━━━━━━━━━━━━━";
const menuRow: InlineButton[] = [{ text: "🏠 Menu", callback_data: "menu" }];

function screen(text: string, rows: InlineButton[][]): BotScreen {
  return { text, reply_markup: { inline_keyboard: rows } };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fullName(firstName?: string, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Bio Bhaiya";
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function planDetails(
  title: string,
  price: string,
  duration: string,
  concurrentCalls: number,
): string {
  return [
    `🎁 ${title}`,
    divider,
    `┌ 💵 Price ▹ ${price}`,
    `├ ⏳ Duration ▹ ${duration}`,
    "├ 📞 Minutes ▹ ∞ Unlimited",
    `├ 🚦 CC Limit ▹ ${concurrentCalls}`,
    "├ 🎛️ DTMF ▹ ✅ Included",
    "├ 🛰️ Live Panel ▹ —",
    "└ 📞 Internal Calls ▹ ✅ Included",
    divider,
  ].join("\n");
}

export function welcomeScreen(firstName?: string, lastName?: string): BotScreen {
  const name = escapeHtml(fullName(firstName, lastName));

  return screen(
    [
      `<b>👋 Welcome back, ${name}!</b>`,
      divider,
      "📋 Plan ▹ None",
      "⌛ Status ▹ No active subscription",
      "💰 Wallet ▹ $0.00",
      divider,
      "",
      "<i>💡 Pick a plan or redeem a code to get started.</i>",
    ].join("\n"),
    [
      [
        { text: "💳 Buy Plan", callback_data: "buy_plan" },
        { text: "🎁 Redeem Code", callback_data: "redeem_code" },
      ],
      [{ text: "💰 Wallet", callback_data: "wallet" }],
      [
        { text: "👤 Account", callback_data: "account" },
        { text: "❓ FAQ", callback_data: "faq" },
      ],
      [{ text: "📲 Nine App", callback_data: "nine_app" }],
      [{ text: "🌐 Website ↗", callback_data: "website" }],
    ],
  );
}

export function plansScreen(): BotScreen {
  const planText = [
    "💳 Buy plan with wallet",
    divider,
    "💰 Balance ▹ $0.00",
    divider,
    "",
    "💡 <b>Instant activation</b>",
    "Pick a plan — it activates instantly from your balance.",
    "",
    planDetails("1-Day", "$80.00", "1 day", 1),
    planDetails("2-Day", "$150.00  (~$75.00/day)", "2 days", 1),
    planDetails("7-Day", "$450.00  (~$64.29/day)", "1 week", 2),
  ].join("\n");

  return screen(planText, [
    [{ text: "1-Day — $80.00", callback_data: "plan_1_day" }],
    [{ text: "2-Day — $150.00", callback_data: "plan_2_day" }],
    [{ text: "7-Day — $450.00", callback_data: "plan_7_day" }],
    [
      { text: "◀️ Wallet", callback_data: "wallet" },
      ...menuRow,
    ],
  ]);
}

export function walletScreen(): BotScreen {
  return screen(
    [
      "<b>💰 Wallet</b>",
      divider,
      "┌ 💰 Balance ▹ $0.00",
      "├ ⬆️ Lifetime top-ups ▹ $0.00",
      "├ ⬇️ Lifetime spent ▹ $0.00",
      "├ 🕒 Last ▹ no activity yet",
      "├ ⏳ Unpaid ▹ 0 invoices",
      "└ 🧾 Invoices ▹ 0",
      divider,
      "",
      "💡 <b>How top-ups work</b>",
      "Crypto top-ups such as Bitcoin and USDT will appear here after a payment provider is connected. Payments are not enabled yet.",
    ].join("\n"),
    [
      [{ text: "💵 Top up", callback_data: "top_up" }],
      [
        { text: "📜 History", callback_data: "wallet_history" },
        { text: "🧾 Invoices · 0", callback_data: "invoices" },
      ],
      menuRow,
    ],
  );
}

export function walletHistoryScreen(): BotScreen {
  return screen(
    ["<b>📜 Wallet History</b>", divider, "", "No wallet activity yet."].join(
      "\n",
    ),
    [[{ text: "◀️ Wallet", callback_data: "wallet" }, ...menuRow]],
  );
}

export function invoicesScreen(): BotScreen {
  return screen(
    [
      "<b>🧾 Invoices</b>",
      divider,
      "┌ ⏳ Open ▹ 0",
      "├ ✅ Paid ▹ 0",
      "├ ⌛ Expired ▹ 0",
      "└ 🧾 All ▹ 0",
      divider,
      "",
      "💡 <b>Invoices</b>",
      "No invoices yet. A payment provider must be connected before this bot can create or accept payments.",
    ].join("\n"),
    [
      [{ text: "💵 Top up", callback_data: "top_up" }],
      [{ text: "◀️ Wallet", callback_data: "wallet" }, ...menuRow],
    ],
  );
}

export function accountScreen(profile: TelegramUserProfile): BotScreen {
  const displayName = escapeHtml(
    fullName(profile.firstName, profile.lastName),
  );
  const username = profile.username
    ? `@${escapeHtml(profile.username)}`
    : "Not set";
  const joined = profile.firstSeenAt.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  return screen(
    [
      "<b>👤 My Account</b>",
      divider,
      `┌ 👤 Name ▹ ${displayName}`,
      `├ 📲 Username ▹ ${username}`,
      `├ 🆔 Telegram ID ▹ ${profile.telegramId}`,
      `├ 📅 Joined ▹ ${joined}`,
      "├ 🎟️ Lifetime subs ▹ 0",
      "└ 💰 Wallet balance ▹ $0.00",
      divider,
    ].join("\n"),
    [
      [{ text: "💰 Open Wallet", callback_data: "wallet" }],
      menuRow,
    ],
  );
}

export function nineAppScreen(): BotScreen {
  return screen(
    [
      "<b>📲 Nine App</b>",
      divider,
      "Your line, wallet and calls on a screen -- and the place to call from.",
      "",
      "💡 <b>Opens with your first plan</b>",
      "Your username and password appear here once you have bought a plan or redeemed a code in this bot.",
    ].join("\n"),
    [
      [
        { text: "💳 Buy Plan", callback_data: "buy_plan" },
        { text: "🎁 Redeem Code", callback_data: "redeem_code" },
      ],
      menuRow,
    ],
  );
}

export function redeemCodeScreen(): BotScreen {
  return screen(
    [
      "<b>🎁 Redeem Code</b>",
      divider,
      "Send the code you received.",
      "Format: XXXX-XXXX-XXXX",
      "<i>💡 Codes are case-insensitive; dashes are optional.</i>",
    ].join("\n"),
    [[{ text: "❌ Cancel", callback_data: "redeem_cancel" }]],
  );
}

export function redeemUnavailableScreen(): BotScreen {
  return screen(
    [
      "<b>❌ Code redemption isn't set up yet</b>",
      divider,
      "No code was redeemed. Code validation will be enabled after a redeem-code source is connected.",
    ].join("\n"),
    [
      [{ text: "🎁 Try another code", callback_data: "redeem_code" }],
      menuRow,
    ],
  );
}

export function topUpUnavailableScreen(): BotScreen {
  return screen(
    [
      "<b>❌ Top-up isn't set up yet</b>",
      divider,
      "No invoice was created and no payment was taken.",
      "Connect a crypto payment provider before sending funds.",
    ].join("\n"),
    [
      [{ text: "💰 Wallet", callback_data: "wallet" }],
      menuRow,
    ],
  );
}

export function faqScreen(): BotScreen {
  return screen(
    ["<b>❓ FAQ</b>", divider, "Tap a question to see the answer:"].join("\n"),
    [
      [
        {
          text: "📅 How do subscriptions work?",
          callback_data: "faq_subscriptions",
        },
      ],
      [
        {
          text: "📲 What is a SIP account?",
          callback_data: "faq_sip",
        },
      ],
      [
        {
          text: "📲 Recommended app (PortSIP)",
          callback_data: "faq_app",
        },
      ],
      [
        {
          text: "💳 Supported payments",
          callback_data: "faq_payments",
        },
      ],
      [
        {
          text: "🎛️ What is DTMF monitoring?",
          callback_data: "faq_dtmf",
        },
      ],
      [{ text: "↩️ Refund policy", callback_data: "faq_refund" }],
      menuRow,
    ],
  );
}

const faqAnswers: Record<string, string> = {
  faq_subscriptions: [
    "<b>📅 How do subscriptions work?</b>",
    divider,
    "Choose a 1-Day, 2-Day or 7-Day plan. The screenshot flow activates a plan from your wallet balance. Live payment and activation are not enabled yet.",
  ].join("\n"),
  faq_sip: [
    "<b>📲 What is a SIP account?</b>",
    divider,
    "It provides the calling credentials used by a SIP app. Your username and password are intended to appear in Nine App after a plan is active or a code is redeemed.",
  ].join("\n"),
  faq_app: [
    "<b>📲 Recommended app (PortSIP)</b>",
    divider,
    "PortSIP is the app named in this bot. Your SIP credentials will be needed to use it once an account plan is active.",
  ].join("\n"),
  faq_payments: [
    "<b>💳 Supported payments</b>",
    divider,
    "Bitcoin, USDT and other crypto are shown as intended payment methods. Payment processing is not connected yet. Do not send funds to this bot.",
  ].join("\n"),
  faq_dtmf: [
    "<b>🎛️ What is DTMF monitoring?</b>",
    divider,
    "DTMF is the keypad tones used during calls. The screenshots list DTMF as included in each displayed plan.",
  ].join("\n"),
  faq_refund: [
    "<b>↩️ Refund policy</b>",
    divider,
    "Refund policy details have not been provided yet.",
  ].join("\n"),
};

export function faqAnswerScreen(question: string): BotScreen {
  const answer = faqAnswers[question];
  if (!answer) return faqScreen();

  return screen(answer, [
    [
      { text: "◀️ FAQ", callback_data: "faq" },
      ...menuRow,
    ],
  ]);
}

export function insufficientBalanceFor(planId: string): BotScreen | undefined {
  const plan = plans.find((candidate) => candidate.id === planId);
  if (!plan) return undefined;

  return screen(
    [
      "<b>❌ Not enough balance</b>",
      divider,
      `┌ 📋 Plan ▹ ${plan.title}`,
      `├ 💳 Price ▹ ${money(plan.price)}`,
      "├ 💰 Balance ▹ $0.00",
      `└ ⬆️ Missing ▹ ${money(plan.price)}`,
      divider,
      "",
      "💡 <b>Top up first</b>",
      `Top up ${money(plan.price)} and the plan activates from your balance.`,
    ].join("\n"),
    [
      [{ text: `💵 Top up ${plan.topUpLabel}`, callback_data: "top_up" }],
      [
        { text: "◀️ Plans", callback_data: "buy_plan" },
        ...menuRow,
      ],
    ],
  );
}

export function websiteNotConfiguredText(): string {
  return "The website link hasn't been set up yet.";
}
