import {
  cryptoCurrencies,
  findCryptoCurrency,
  type CryptoCode,
} from "./telegram-crypto-currencies";
import type { BotScreen, InlineButton } from "./telegram-bot-screens";

const divider = "━━━━━━━━━━━━━━━━━━━━";
const menuButton: InlineButton = { text: "🏠 Menu", callback_data: "admin_menu" };

function screen(text: string, rows: InlineButton[][]): BotScreen {
  return { text, reply_markup: { inline_keyboard: rows } };
}

export function adminPanelScreen(
  configuredCodes: Set<string>,
  websiteConfigured: boolean,
  iosConfigured: boolean = false,
  androidConfigured: boolean = false,
): BotScreen {
  const statusLines = cryptoCurrencies.map((currency) => {
    const status = configuredCodes.has(currency.code) ? "✅ set" : "⚠️ not set";
    return `${currency.label} ▹ ${status}`;
  });
  const currencyRows: InlineButton[][] = [];

  for (let index = 0; index < cryptoCurrencies.length; index += 2) {
    currencyRows.push(
      cryptoCurrencies.slice(index, index + 2).map((currency) => ({
        text: `${configuredCodes.has(currency.code) ? "✅" : "➕"} ${currency.label}`,
        callback_data: `admin_set_${currency.code}`,
      })),
    );
  }

  return screen(
    [
      "<b>🛠 Admin Panel</b>",
      divider,
      "Set or update a deposit address for each network.",
      "",
      ...statusLines,
      `🌐 Website ▹ ${websiteConfigured ? "✅ set" : "⚠️ not set"}`,
      `🍏 iOS App ▹ ${iosConfigured ? "✅ set" : "⚠️ not set"}`,
      `🤖 Android App ▹ ${androidConfigured ? "✅ set" : "⚠️ not set"}`,
      "",
      "Only the configured bot admin can change these settings.",
    ].join("\n"),
    [
      ...currencyRows.slice(0, 3),
      [
        currencyRows[3]?.[0] ?? {
          text: "➕ TON",
          callback_data: "admin_set_TON",
        },
        { text: "🌐 Website link", callback_data: "admin_set_website" },
      ],
      [
        { text: "🍏 iOS App Link", callback_data: "admin_set_ios_app" },
        { text: "🤖 Android App Link", callback_data: "admin_set_android_app" },
      ],
      [{ text: "📊 Statistics", callback_data: "admin_stats" }],
      [menuButton],
    ],
  );
}

export function adminStatsScreen(stats: {
  totalUsers: number;
  last7Days: number;
  last24Hours: number;
  today: number;
  yesterday: number;
  thisWeekDaily: { date: string; count: number }[];
  updatedAt: Date;
}): BotScreen {
  const dailyLines = stats.thisWeekDaily.map(d => `${d.date}: ${d.count} new`).join("\n");
  const timeStr = stats.updatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return screen(
    [
      "<b>📊 Bot Statistics</b>",
      divider,
      `👥 <b>Total Users:</b> ${stats.totalUsers}`,
      `🆕 <b>Last 7 Days:</b> ${stats.last7Days} new`,
      `⏰ <b>Last 24 Hours:</b> ${stats.last24Hours} new`,
      `📅 <b>Today:</b> ${stats.today} new`,
      `📆 <b>Yesterday:</b> ${stats.yesterday} new`,
      "",
      "<b>📈 Last 7 Days Daily:</b>",
      dailyLines || "No data yet",
      "",
      `🕒 Updated: ${timeStr}`,
    ].join("\n"),
    [
      [{ text: "🔄 Refresh", callback_data: "admin_stats" }],
      [{ text: "⬅️ Back to Admin Panel", callback_data: "admin_back" }],
      [menuButton],
    ],
  );
}

export function adminAddressPromptScreen(code: CryptoCode): BotScreen {
  const currency = findCryptoCurrency(code);
  return screen(
    [
      `<b>📥 Set ${currency?.label ?? code} address</b>`,
      divider,
      `Network: ${currency?.network ?? code}`,
      "Send the deposit address for this network.",
      "The current address will be replaced for future top-up quotes.",
    ].join("\n"),
    [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]],
  );
}

export function adminAppUrlPromptScreen(type: "ios" | "android"): BotScreen {
  const isIOS = type === "ios";
  return screen(
    [
      `<b>${isIOS ? "🍏 Set iOS App Link" : "🤖 Set Android App Link"}</b>`,
      divider,
      `Send the ${isIOS ? "iOS App Store" : "Google Play Store"} URL starting with https://`,
      `Example: https://apps.apple.com/app/your-app or https://play.google.com/store/apps/details?id=com.example`,
      "This link will be shown in the PortSIP FAQ with iOS/Android buttons.",
    ].join("\n"),
    [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]],
  );
}

export function adminAppUrlInvalidScreen(type: "ios" | "android"): BotScreen {
  const isIOS = type === "ios";
  return screen(
    [
      "<b>❌ App link not valid</b>",
      divider,
      `Send a valid public HTTPS URL for ${isIOS ? "iOS App Store" : "Google Play"}.`,
      "Links must start with https:// and cannot contain passwords.",
    ].join("\n"),
    [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]],
  );
}

export function adminAppUrlSavedScreen(
  type: "ios" | "android",
  url: string,
  configuredCodes: Set<string>,
  websiteConfigured: boolean,
  iosConfigured: boolean,
  androidConfigured: boolean
): BotScreen {
  const isIOS = type === "ios";
  const panel = adminPanelScreen(configuredCodes, websiteConfigured, iosConfigured, androidConfigured);
  const safeUrl = url.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return screen(
    [
      `<b>✅ ${isIOS ? "iOS" : "Android"} App link saved</b>`,
      divider,
      `<code>${safeUrl}</code>`,
      "PortSIP FAQ will now show this link in iOS/Android buttons.",
      "",
      panel.text,
    ].join("\n"),
    panel.reply_markup.inline_keyboard,
  );
}

export function adminAddressInvalidScreen(code: CryptoCode): BotScreen {
  const currency = findCryptoCurrency(code);
  return screen(
    [
      "<b>❌ Address format doesn't look right</b>",
      divider,
      `Check the ${currency?.label ?? code} address and send it again.`,
    ].join("\n"),
    [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]],
  );
}

export function adminAddressSavedScreen(
  code: CryptoCode,
  configuredCodes: Set<string>,
  websiteConfigured: boolean,
  iosConfigured: boolean = false,
  androidConfigured: boolean = false,
): BotScreen {
  const currency = findCryptoCurrency(code);
  const panel = adminPanelScreen(configuredCodes, websiteConfigured, iosConfigured, androidConfigured);
  return screen(
    [
      `<b>✅ ${currency?.label ?? code} address saved</b>`,
      divider,
      "Future top-up quotes will use the updated address. Existing quotes keep their original address.",
      "",
      panel.text,
    ].join("\n"),
    panel.reply_markup.inline_keyboard,
  );
}

export function adminWebsitePromptScreen(): BotScreen {
  return screen(
    [
      "<b>🌐 Set Website Link</b>",
      divider,
      "Send the public website URL starting with https://",
      "The new link will replace the current one in the main menu.",
    ].join("\n"),
    [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]],
  );
}

export function adminWebsiteInvalidScreen(): BotScreen {
  return screen(
    [
      "<b>❌ Website link not valid</b>",
      divider,
      "Send a valid public HTTPS URL. Links with passwords or other protocols are not allowed.",
    ].join("\n"),
    [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]],
  );
}

export function adminWebsiteSavedScreen(
  websiteUrl: string,
  configuredCodes: Set<string>,
  iosConfigured: boolean = false,
  androidConfigured: boolean = false,
): BotScreen {
  const panel = adminPanelScreen(configuredCodes, true, iosConfigured, androidConfigured);
  const safeUrl = websiteUrl
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return screen(
    [
      "<b>✅ Website link saved</b>",
      divider,
      `<code>${safeUrl}</code>`,
      "New main-menu screens will open this link.",
      "",
      panel.text,
    ].join("\n"),
    panel.reply_markup.inline_keyboard,
  );
}

export function adminUnauthorizedScreen(): BotScreen {
  return screen(
    [
      "<b>⛔ Admin access denied</b>",
      divider,
      "This command is available only to the authorized admin.",
    ].join("\n"),
    [[{ text: "🏠 Menu", callback_data: "menu" }]],
  );
}

export function adminPrivateChatOnlyScreen(): BotScreen {
  return screen(
    [
      "<b>🔒 Open a private chat</b>",
      divider,
      "Use /admin in a private chat with this bot. Admin settings can't be changed in groups.",
    ].join("\n"),
    [[{ text: "🏠 Menu", callback_data: "menu" }]],
  );
}

export function adminStorageUnavailableScreen(): BotScreen {
  return screen(
    [
      "<b>⚠️ Admin settings unavailable</b>",
      divider,
      "The admin settings could not be loaded or saved. Please try /admin again.",
    ].join("\n"),
    [[{ text: "🔄 Retry", callback_data: "admin_retry" }]],
  );
}
