import type { TelegramUser as TelegramUserProfile } from "@workspace/db";

export type InlineButton =
  | { text: string; callback_data: string; url?: never }
  | { text: string; url: string; callback_data?: never };

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
    `┣ 💵 Price ▹ ${price}`,
    `┣ ⏳ Duration ▹ ${duration}`,
    "┣ 📞 Minutes ▹ ∞ Unlimited",
    `┣ 🚦 CC Limit ▹ ${concurrentCalls}`,
    "┣ 🎛️ DTMF ▹ ✅ Included",
    "┣ 🛰️ Live Panel ▹ —",
    "┗ 📞 Internal Calls ▹ ✅ Included",
    divider,
  ].join("\n");
}

export function welcomeScreen(
  firstName?: string,
  lastName?: string,
  websiteUrl?: string,
): BotScreen {
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
      [
        websiteUrl
          ? { text: "🌐 Website", url: websiteUrl }
          : { text: "🌐 Website", callback_data: "website" },
      ],
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
      "┣ 💰 Balance ▹ $0.00",
      "┣ ⬆️ Lifetime top-ups ▹ $0.00",
      "┣ ⬇️ Lifetime spent ▹ $0.00",
      "┣ 🕒 Last ▹ no activity yet",
      "┣ ⏳ Unpaid ▹ 0 invoices",
      "┗ 🧾 Invoices ▹ 0",
      divider,
      "",
      "💡 <b>How top-ups work</b>",
      "Top-up quotes can show an admin-set crypto address.",
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
      "┣ ⏳ Open ▹ 0",
      "┣ ✅ Paid ▹ 0",
      "┣ ⌛ Expired ▹ 0",
      "┗ 🧾 All ▹ 0",
      divider,
      "",
      "💡 <b>Invoices</b>",
      "No paid invoices yet. The bot can show top-up quotes, but does not detect deposits or credit your balance automatically.",
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
      `┣ 👤 Name ▹ ${displayName}`,
      `┣ 📲 Username ▹ ${username}`,
      `┣ 🆔 Telegram ID ▹ ${profile.telegramId}`,
      `┣ 📅 Joined ▹ ${joined}`,
      "┣ 🎟️ Lifetime subs ▹ 0",
      "┗ 💰 Wallet balance ▹ $0.00",
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
    "A subscription unlocks outbound calling for a fixed duration (1 day, 1 week, 30 days — whatever plans the operator offers).",
    "",
    "Activate a plan by either:",
    "• Topping up your wallet and buying one, or",
    "• Redeeming a code you were given",
    "",
    "Your SIP account, settings and call history persist across renewals.",
  ].join("\n"),
  faq_sip: [
    "<b>📱 What is a SIP account?</b>",
    divider,
    "A SIP account lets you place calls from any softphone — we recommend PortSIP (see the app topic).",
    "",
    "Steps:",
    "1. Tap SIP Account from the menu",
    "2. Copy the server, port, username and password",
    "3. Enter them in your softphone and start calling",
  ].join("\n"),
  faq_app: [
    "<b>📲 PortSIP Softphone</b>",
    divider,
    "We recommend PortSIP Softphone — a free, reliable SIP app for iOS and Android.",
    "",
    "Setup:",
    "1. Install PortSIP from a button below",
    "2. Open SIP Account in the menu and copy your server, username and password",
    "3. Add them as a new account in PortSIP and start calling.",
    "",
    "👇 Download for your phone:",
  ].join("\n"),
  faq_payments: [
    "<b>💳 Supported payments</b>",
    divider,
    "Payments are processed by our provider.",
    "",
    "Currencies: BTC, XMR, USDT (TRC20/BEP20), ETH and more",
    "Confirmations: arrive 1–3 minutes after the blockchain confirms.",
    "",
    "Tap Pay Now on the invoice screen — it opens the secure payment page where you pick your crypto and follow the on-chain instructions.",
  ].join("\n"),
  faq_dtmf: [
    "<b>🎛️ What is DTMF monitoring?</b>",
    divider,
    "DTMF sends you a notification each time the other party presses a key during your active call.",
    "",
    "Use it for: seeing what the other side keys in, call-quality checks, monitoring automated-dial campaigns.",
    "",
    "Toggle it with the 🎛️ button on the main menu.",
  ].join("\n"),
  faq_refund: [
    "<b>↩️ Refund policy</b>",
    divider,
    "Subscriptions are final and non-refundable once activated.",
  ].join("\n"),
};

export function faqAnswerScreen(question: string): BotScreen {
  const answer = faqAnswers[question];
  if (!answer) return faqScreen();

  // faq_app (PortSIP) will be handled separately with app store buttons via portSipScreen
  return screen(answer, [
    [
      { text: "◀️ FAQ", callback_data: "faq" },
      ...menuRow,
    ],
  ]);
}

export function portSipScreen(iosUrl?: string, androidUrl?: string): BotScreen {
  const text = faqAnswers["faq_app"];
  const appRow: InlineButton[] = [];
  if (iosUrl) {
    appRow.push({ text: "🍏 iOS – App Store", url: iosUrl });
  } else {
    appRow.push({ text: "🍏 iOS – App Store", callback_data: "app_link_not_set" });
  }
  if (androidUrl) {
    appRow.push({ text: "🤖 Android – Google Play", url: androidUrl });
  } else {
    appRow.push({ text: "🤖 Android – Google Play", callback_data: "app_link_not_set" });
  }

  return screen(text, [
    [appRow[0]!, appRow[1]!],
    [{ text: "◀️ FAQ", callback_data: "faq" }, ...menuRow],
  ]);
}

export function appLinkNotConfiguredScreen(): BotScreen {
  return screen(
    [
      "<b>📲 App Link</b>",
      divider,
      "The admin hasn't set this app store link yet.",
      "Please ask the admin to set it via /admin → iOS/Android App Link.",
    ].join("\n"),
    [[{ text: "◀️ FAQ", callback_data: "faq" }, ...menuRow]],
  );
}

export function callerIdUnavailableScreen(): BotScreen {
  return screen(
    [
      "<b>📞 Caller ID</b>",
      divider,
      "Caller ID changes aren't connected yet. No caller ID was changed.",
    ].join("\n"),
    [menuRow],
  );
}

export function insufficientBalanceFor(planId: string): BotScreen | undefined {
  const plan = plans.find((candidate) => candidate.id === planId);
  if (!plan) return undefined;

  return screen(
    [
      "<b>❌ Not enough balance</b>",
      divider,
      `┣ 📋 Plan ▹ ${plan.title}`,
      `┣ 💳 Price ▹ ${money(plan.price)}`,
      "┣ 💰 Balance ▹ $0.00",
      `┗ ⬆️ Missing ▹ ${money(plan.price)}`,
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
  return "The admin hasn't set the website link yet.";
}

export function websiteLinkScreen(websiteUrl: string): BotScreen {
  return screen(
    ["<b>🌐 Website</b>", divider, "Open the configured website:"].join("\n"),
    [
      [{ text: "🌐 Open Website", url: websiteUrl }],
      menuRow,
    ],
  );
}
