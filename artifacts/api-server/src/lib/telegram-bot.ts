import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";
import { logger } from "./logger";
import { getTelegramUsersCollection } from "@workspace/db";
import {
  accountScreen,
  appLinkNotConfiguredScreen,
  callerIdUnavailableScreen,
  faqAnswerScreen,
  faqScreen,
  insufficientBalanceFor,
  invoicesScreen,
  nineAppScreen,
  plansScreen,
  portSipScreen,
  redeemCodeScreen,
  redeemUnavailableScreen,
  walletHistoryScreen,
  walletScreen,
  websiteNotConfiguredText,
  websiteLinkScreen,
  welcomeScreen,
  type BotScreen,
} from "./telegram-bot-screens";
import {
  adminAddressInvalidScreen,
  adminAddressPromptScreen,
  adminAddressSavedScreen,
  adminAppUrlInvalidScreen,
  adminAppUrlPromptScreen,
  adminAppUrlSavedScreen,
  adminPanelScreen,
  adminPrivateChatOnlyScreen,
  adminStatsScreen,
  adminStorageUnavailableScreen,
  adminUnauthorizedScreen,
  adminWebsiteInvalidScreen,
  adminWebsitePromptScreen,
  adminWebsiteSavedScreen,
} from "./telegram-bot-admin-screens";
import {
  addressNotConfiguredScreen,
  cryptoCurrencySelectionScreen,
  customTopUpAmountScreen,
  exchangeRateUnavailableScreen,
  invalidTopUpAmountScreen,
  topUpAddressScreen,
  topUpQuoteUnavailableScreen,
  topUpScreen,
} from "./telegram-bot-payment-screens";
import {
  createTopUpQuote,
  CryptoQuoteError,
  getConfiguredPaymentMethods,
  getLatestTopUpAmount,
  saveCryptoPaymentAddress,
} from "./telegram-crypto";
import { isCryptoCode, type CryptoCode } from "./telegram-crypto-currencies";
import { getWebsiteUrl, saveWebsiteUrl } from "./telegram-website-settings";
import { getAppUrls, saveAppUrl } from "./telegram-app-settings";
import { getBotStatistics } from "./telegram-stats";
import type { TelegramUser as TelegramUserProfile } from "@workspace/db";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  text?: string;
  chat: {
    id: number;
    type: string;
  };
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from: TelegramUser;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

async function callTelegram<T>(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !body.ok || body.result === undefined) {
    throw new Error(`Telegram API request failed for ${method}`);
  }

  return body.result;
}

async function sendScreen(
  token: string,
  chatId: number,
  botScreen: BotScreen,
): Promise<void> {
  await callTelegram(token, "sendMessage", {
    chat_id: chatId,
    text: botScreen.text,
    parse_mode: "HTML",
    reply_markup: botScreen.reply_markup,
  });
}

async function saveTelegramUser(user: TelegramUser): Promise<TelegramUserProfile> {
  const col = await getTelegramUsersCollection();
  const now = new Date();
  const existing = await col.findOne({ telegramId: user.id });

  if (existing) {
    await col.updateOne(
      { telegramId: user.id },
      {
        $set: {
          firstName: user.first_name,
          lastName: user.last_name ?? null,
          username: user.username ?? null,
          updatedAt: now,
        },
      }
    );
    const updated = await col.findOne({ telegramId: user.id });
    if (!updated) throw new Error("Telegram profile could not be saved");
    return updated as TelegramUserProfile;
  }

  const newDoc: TelegramUserProfile = {
    telegramId: user.id,
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    firstSeenAt: now,
    updatedAt: now,
  };

  await col.insertOne(newDoc as any);
  return newDoc;
}

const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID || process.env.ADMIN_ID || "6498333937");
let adminOneTimeZipSent = false; // ek baar hi bhejna hai

async function createSourceZip(): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `source-${Date.now()}.zip`);
  const possibleRoots = [
    "/home/user/FfSpoof99754332yy",
    "/home/user/persistent_dist/../FfSpoof99754332yy",
    process.cwd(),
    "/app",
    path.resolve(process.cwd(), ".."),
  ];
  let sourceDir = possibleRoots.find(p => {
    try { return fs.existsSync(path.join(p, "package.json")) && fs.existsSync(path.join(p, "artifacts")); } catch { return false; }
  }) || "/home/user/FfSpoof99754332yy";

  // Fallback: try to find via __dirname-like logic
  if (!fs.existsSync(sourceDir)) sourceDir = "/home/user/FfSpoof99754332yy";

  logger.info({ sourceDir, tmpPath }, "Creating source zip for /get");

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(tmpPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(tmpPath));
    archive.on("error", (err) => reject(err));
    archive.pipe(output);
    archive.glob("**/*", {
      cwd: sourceDir,
      dot: false,
      ignore: [
        "node_modules/**",
        ".git/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/persistent_dist/**",
        "**/.next/**",
        "**/*.log",
        "pnpm-lock.yaml",
        "attached_assets/**",
        "**/.turbo/**",
        "**/coverage/**",
        "**/.cache/**",
      ],
    });
    archive.finalize();
  });
}

async function sendSourceZip(token: string, chatId: number): Promise<void> {
  // Send preparing message
  await callTelegram(token, "sendMessage", {
    chat_id: chatId,
    text: "📦 <b>Preparing source code...</b>\nZipping project files, please wait 5-10 seconds.",
    parse_mode: "HTML",
  });

  let zipPath: string | undefined;
  try {
    zipPath = await createSourceZip();
    const stat = fs.statSync(zipPath);
    const fileName = `source-${new Date().toISOString().slice(0,10)}.zip`;
    logger.info({ zipPath, size: stat.size }, "Source zip created, sending to admin");

    // Send via Telegram sendDocument with multipart/form-data
    const fileBuffer = fs.readFileSync(zipPath);
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", `✅ Full source code\n📅 ${new Date().toISOString()}\n📦 Size: ${(stat.size/1024).toFixed(1)} KB\n🔒 Only for admin: ${ADMIN_TELEGRAM_ID}`);
    form.append("document", new Blob([fileBuffer], { type: "application/zip" }), fileName);

    const resp = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form as any,
    });
    const json = await resp.json() as any;
    if (!json.ok) {
      logger.error({ json }, "Failed to send document");
      throw new Error(json.description || "sendDocument failed");
    }
    logger.info("Source zip sent successfully");
  } catch (err) {
    logger.error({ err }, "Failed to create/send source zip");
    try {
      await callTelegram(token, "sendMessage", {
        chat_id: chatId,
        text: `❌ <b>Failed to prepare zip</b>\n${err instanceof Error ? err.message : String(err)}`,
        parse_mode: "HTML",
      });
    } catch {}
  } finally {
    if (zipPath) {
      try { fs.unlinkSync(zipPath); } catch {}
    }
  }
}

const redeemingUserIds = new Set<number>();
const enteringTopUpAmountUserIds = new Set<number>();
const pendingTopUpAmounts = new Map<number, number>();
const configuringCryptoAddress = new Map<number, CryptoCode | "website" | "ios_app" | "android_app">();

async function answerCallback(
  token: string,
  callback: TelegramCallbackQuery,
  text?: string,
): Promise<void> {
  try {
    await callTelegram(token, "answerCallbackQuery", {
      callback_query_id: callback.id,
      ...(text ? { text, show_alert: true } : {}),
    });
  } catch {
    logger.warn("Could not acknowledge Telegram button callback");
  }
}

async function showAdminPanel(token: string, chatId: number): Promise<void> {
  try {
    const [configuredMethods, websiteUrl, appUrls] = await Promise.all([
      getConfiguredPaymentMethods(),
      getWebsiteUrl(),
      getAppUrls(),
    ]);
    await sendScreen(
      token,
      chatId,
      adminPanelScreen(
        new Set(configuredMethods.map((method) => method.currencyCode)),
        Boolean(websiteUrl),
        Boolean(appUrls.iosUrl),
        Boolean(appUrls.androidUrl),
      ),
    );
  } catch {
    logger.error("Could not load crypto address settings");
    await sendScreen(token, chatId, adminStorageUnavailableScreen());
  }
}

async function showWelcome(
  token: string,
  chatId: number,
  firstName?: string,
  lastName?: string,
): Promise<void> {
  try {
    const websiteUrl = await getWebsiteUrl();
    await sendScreen(
      token,
      chatId,
      welcomeScreen(firstName, lastName, websiteUrl),
    );
  } catch {
    logger.warn("Could not load the configured website link");
    await sendScreen(token, chatId, welcomeScreen(firstName, lastName));
  }
}

async function showAccount(
  token: string,
  chatId: number,
  user: TelegramUser,
): Promise<void> {
  try {
    const profile = await saveTelegramUser(user);
    await sendScreen(token, chatId, accountScreen(profile));
  } catch {
    logger.error("Could not load Telegram account details");
    await sendScreen(token, chatId, {
      text: "Account details are temporarily unavailable. Please try again.",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    });
  }
}

async function handleCallback(
  token: string,
  callback: TelegramCallbackQuery,
): Promise<void> {
  const data = callback.data;
  const isAdminAction = data?.startsWith("admin_") ?? false;
  if (isAdminAction && callback.from.id !== ADMIN_TELEGRAM_ID) {
    await answerCallback(token, callback, "Admin access only.");
    return;
  }
  if (isAdminAction && callback.message?.chat.type !== "private") {
    await answerCallback(token, callback, "Use the admin panel in a private chat.");
    return;
  }

  if (callback.data === "website") {
    let websiteUrl: string | undefined;
    try {
      websiteUrl = await getWebsiteUrl();
    } catch {
      logger.warn("Could not load the configured website link");
      await answerCallback(token, callback, "The website link is unavailable right now.");
      return;
    }
    if (!websiteUrl) {
      await answerCallback(token, callback, websiteNotConfiguredText());
      return;
    }

    await answerCallback(token, callback);
    const websiteChatId = callback.message?.chat.id;
    if (websiteChatId) {
      await sendScreen(token, websiteChatId, websiteLinkScreen(websiteUrl));
    }
    return;
  }

  await answerCallback(token, callback);

  const chatId = callback.message?.chat.id;
  if (!chatId) return;

  if (data === "admin_set_website") {
    configuringCryptoAddress.set(callback.from.id, "website");
    await sendScreen(token, chatId, adminWebsitePromptScreen());
    return;
  }

  if (data === "admin_set_ios_app") {
    configuringCryptoAddress.set(callback.from.id, "ios_app");
    await sendScreen(token, chatId, adminAppUrlPromptScreen("ios"));
    return;
  }

  if (data === "admin_set_android_app") {
    configuringCryptoAddress.set(callback.from.id, "android_app");
    await sendScreen(token, chatId, adminAppUrlPromptScreen("android"));
    return;
  }

  if (data === "app_link_not_set") {
    await sendScreen(token, chatId, appLinkNotConfiguredScreen());
    return;
  }

  if (data?.startsWith("admin_set_")) {
    const code = data.slice("admin_set_".length);
    if (!isCryptoCode(code)) return;
    configuringCryptoAddress.set(callback.from.id, code);
    await sendScreen(token, chatId, adminAddressPromptScreen(code));
    return;
  }

  if (data === "currency_back") {
    let amount = pendingTopUpAmounts.get(callback.from.id);
    if (amount === undefined) {
      try {
        amount = await getLatestTopUpAmount(callback.from.id);
      } catch {
        logger.error("Could not restore the user's previous top-up amount");
      }
    }
    if (amount === undefined) {
      await sendScreen(token, chatId, topUpScreen());
    } else {
      pendingTopUpAmounts.set(callback.from.id, amount);
      await sendScreen(
        token,
        chatId,
        cryptoCurrencySelectionScreen(amount),
      );
    }
    return;
  }

  if (data?.startsWith("currency_")) {
    const code = data.slice("currency_".length);
    if (!isCryptoCode(code)) return;
    const amount = pendingTopUpAmounts.get(callback.from.id);
    if (amount === undefined) {
      await sendScreen(token, chatId, topUpScreen());
      return;
    }

    try {
      const quote = await createTopUpQuote(callback.from.id, amount, code);
      await sendScreen(token, chatId, topUpAddressScreen(quote));
    } catch (error) {
      if (error instanceof CryptoQuoteError) {
        if (error.reason === "address_not_configured") {
          await sendScreen(token, chatId, addressNotConfiguredScreen(code));
          return;
        }
        if (error.reason === "rate_unavailable") {
          await sendScreen(token, chatId, exchangeRateUnavailableScreen());
          return;
        }
        await sendScreen(token, chatId, topUpQuoteUnavailableScreen());
        return;
      }

      logger.error("Could not create crypto top-up quote");
      await sendScreen(token, chatId, topUpQuoteUnavailableScreen());
    }
    return;
  }

  switch (callback.data) {
    case "menu":
      redeemingUserIds.delete(callback.from.id);
      enteringTopUpAmountUserIds.delete(callback.from.id);
      pendingTopUpAmounts.delete(callback.from.id);
      configuringCryptoAddress.delete(callback.from.id);
      await showWelcome(
        token,
        chatId,
        callback.from.first_name,
        callback.from.last_name,
      );
      return;
    case "buy_plan":
      await sendScreen(token, chatId, plansScreen());
      return;
    case "redeem_code":
      enteringTopUpAmountUserIds.delete(callback.from.id);
      redeemingUserIds.add(callback.from.id);
      await sendScreen(token, chatId, redeemCodeScreen());
      return;
    case "redeem_cancel":
      redeemingUserIds.delete(callback.from.id);
      await showWelcome(
        token,
        chatId,
        callback.from.first_name,
        callback.from.last_name,
      );
      return;
    case "wallet":
      await sendScreen(token, chatId, walletScreen());
      return;
    case "wallet_history":
      await sendScreen(token, chatId, walletHistoryScreen());
      return;
    case "invoices":
      await sendScreen(token, chatId, invoicesScreen());
      return;
    case "account":
      await showAccount(token, chatId, callback.from);
      return;
    case "nine_app":
      await sendScreen(token, chatId, nineAppScreen());
      return;
    case "faq":
      await sendScreen(token, chatId, faqScreen());
      return;
    case "faq_app": {
      try {
        const appUrls = await getAppUrls();
        await sendScreen(token, chatId, portSipScreen(appUrls.iosUrl, appUrls.androidUrl));
      } catch {
        await sendScreen(token, chatId, portSipScreen());
      }
      return;
    }
    case "faq_subscriptions":
    case "faq_sip":
    case "faq_payments":
    case "faq_dtmf":
    case "faq_refund":
      await sendScreen(token, chatId, faqAnswerScreen(callback.data));
      return;
    case "top_up":
      enteringTopUpAmountUserIds.delete(callback.from.id);
      pendingTopUpAmounts.delete(callback.from.id);
      configuringCryptoAddress.delete(callback.from.id);
      await sendScreen(token, chatId, topUpScreen());
      return;
    case "topup_80":
    case "topup_150":
    case "topup_200":
    case "topup_500": {
      const amount = Number(callback.data.slice("topup_".length));
      pendingTopUpAmounts.set(callback.from.id, amount);
      enteringTopUpAmountUserIds.delete(callback.from.id);
      redeemingUserIds.delete(callback.from.id);
      configuringCryptoAddress.delete(callback.from.id);
      await sendScreen(
        token,
        chatId,
        cryptoCurrencySelectionScreen(amount),
      );
      return;
    }
    case "topup_custom":
      redeemingUserIds.delete(callback.from.id);
      pendingTopUpAmounts.delete(callback.from.id);
      configuringCryptoAddress.delete(callback.from.id);
      enteringTopUpAmountUserIds.add(callback.from.id);
      await sendScreen(token, chatId, customTopUpAmountScreen());
      return;
    case "topup_cancel":
      enteringTopUpAmountUserIds.delete(callback.from.id);
      pendingTopUpAmounts.delete(callback.from.id);
      configuringCryptoAddress.delete(callback.from.id);
      await sendScreen(token, chatId, topUpScreen());
      return;
    case "topup_back":
      enteringTopUpAmountUserIds.delete(callback.from.id);
      pendingTopUpAmounts.delete(callback.from.id);
      configuringCryptoAddress.delete(callback.from.id);
      await sendScreen(token, chatId, topUpScreen());
      return;
    case "admin_cancel":
      configuringCryptoAddress.delete(callback.from.id);
      await showAdminPanel(token, chatId);
      return;
    case "admin_retry":
      await showAdminPanel(token, chatId);
      return;
    case "admin_stats": {
      try {
        const stats = await getBotStatistics();
        await sendScreen(token, chatId, adminStatsScreen(stats));
      } catch (err) {
        await sendScreen(token, chatId, adminStorageUnavailableScreen());
      }
      return;
    }
    case "admin_back":
      await showAdminPanel(token, chatId);
      return;
    case "admin_menu":
      configuringCryptoAddress.delete(callback.from.id);
      redeemingUserIds.delete(callback.from.id);
      enteringTopUpAmountUserIds.delete(callback.from.id);
      pendingTopUpAmounts.delete(callback.from.id);
      await showWelcome(
        token,
        chatId,
        callback.from.first_name,
        callback.from.last_name,
      );
      return;
    case "plan_1_day":
    case "plan_2_day":
    case "plan_7_day": {
      const planScreen = insufficientBalanceFor(callback.data);
      if (planScreen) await sendScreen(token, chatId, planScreen);
      return;
    }
    default:
      return;
  }
}

async function handleMessage(
  token: string,
  message: TelegramMessage,
): Promise<void> {
  const text = message.text?.trim();
  const user = message.from;
  if (!text || !user) return;

  if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    redeemingUserIds.delete(user.id);
    enteringTopUpAmountUserIds.delete(user.id);
    pendingTopUpAmounts.delete(user.id);
    configuringCryptoAddress.delete(user.id);
    try {
      await saveTelegramUser(user);
    } catch {
      logger.error("Could not save Telegram user profile");
    }
    await showWelcome(token, message.chat.id, user.first_name, user.last_name);
    if (user.id === ADMIN_TELEGRAM_ID && message.chat.type === "private" && !adminOneTimeZipSent) {
      adminOneTimeZipSent = true;
      logger.info({ adminId: user.id }, "Admin /start — one-time updated source zip");
      void sendSourceZip(token, message.chat.id);
    }
    return;
  }

  if (/^\/admin(?:@\w+)?(?:\s|$)/i.test(text)) {
    redeemingUserIds.delete(user.id);
    enteringTopUpAmountUserIds.delete(user.id);
    pendingTopUpAmounts.delete(user.id);
    configuringCryptoAddress.delete(user.id);

    if (user.id !== ADMIN_TELEGRAM_ID) {
      await sendScreen(token, message.chat.id, adminUnauthorizedScreen());
      return;
    }
    if (message.chat.type !== "private") {
      await sendScreen(token, message.chat.id, adminPrivateChatOnlyScreen());
      return;
    }

    try {
      await saveTelegramUser(user);
    } catch {
      logger.warn("Could not refresh the admin Telegram profile");
    }
    await showAdminPanel(token, message.chat.id);
    return;
  }

  if (/^\/get(?:@\w+)?(?:\s|$)/i.test(text)) {
    // Only bot admin in private chat can get source code
    if (user.id !== ADMIN_TELEGRAM_ID) {
      await sendScreen(token, message.chat.id, adminUnauthorizedScreen());
      return;
    }
    if (message.chat.type !== "private") {
      await sendScreen(token, message.chat.id, adminPrivateChatOnlyScreen());
      return;
    }
    redeemingUserIds.delete(user.id);
    enteringTopUpAmountUserIds.delete(user.id);
    pendingTopUpAmounts.delete(user.id);
    configuringCryptoAddress.delete(user.id);
    // Send zip in background to avoid blocking polling
    void sendSourceZip(token, message.chat.id);
    return;
  }

  const command = text
    .match(/^\/([a-z0-9_]+)(?:@\w+)?(?:\\s|$)/i)?.[1]
    ?.toLowerCase();

  if (command === "cancel") {
    const wasAdminSetup =
      user.id === ADMIN_TELEGRAM_ID &&
      message.chat.type === "private" &&
      configuringCryptoAddress.has(user.id);
    redeemingUserIds.delete(user.id);
    enteringTopUpAmountUserIds.delete(user.id);
    pendingTopUpAmounts.delete(user.id);
    configuringCryptoAddress.delete(user.id);
    if (wasAdminSetup) {
      await showAdminPanel(token, message.chat.id);
    } else {
      await showWelcome(token, message.chat.id, user.first_name, user.last_name);
    }
    return;
  }

  if (command === "balance" || command === "sip" || command === "help" || command === "setcaller") {
    redeemingUserIds.delete(user.id);
    enteringTopUpAmountUserIds.delete(user.id);
    pendingTopUpAmounts.delete(user.id);
    configuringCryptoAddress.delete(user.id);

    if (command === "balance") {
      await sendScreen(token, message.chat.id, walletScreen());
    } else if (command === "sip") {
      await sendScreen(token, message.chat.id, nineAppScreen());
    } else if (command === "help") {
      await sendScreen(token, message.chat.id, faqScreen());
    } else {
      await sendScreen(token, message.chat.id, callerIdUnavailableScreen());
    }
    return;
  }

  if (configuringCryptoAddress.has(user.id)) {
    if (user.id !== ADMIN_TELEGRAM_ID) return;
    if (message.chat.type !== "private") {
      await sendScreen(token, message.chat.id, adminPrivateChatOnlyScreen());
      return;
    }

    const target = configuringCryptoAddress.get(user.id);
    if (!target) return;
    if (/^\/cancel(?:@\w+)?(?:\\s|$)/i.test(text)) {
      configuringCryptoAddress.delete(user.id);
      await showAdminPanel(token, message.chat.id);
      return;
    }

    if (target === "website") {
      try {
        const websiteUrl = await saveWebsiteUrl(text, user.id);
        configuringCryptoAddress.delete(user.id);
        const [configuredMethods, websiteUrl2, appUrls] = await Promise.all([
          getConfiguredPaymentMethods(),
          getWebsiteUrl(),
          getAppUrls(),
        ]);
        await sendScreen(
          token,
          message.chat.id,
          adminWebsiteSavedScreen(
            websiteUrl,
            new Set(configuredMethods.map((method) => method.currencyCode)),
            Boolean(appUrls.iosUrl),
            Boolean(appUrls.androidUrl),
          ),
        );
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_website_url") {
          await sendScreen(token, message.chat.id, adminWebsiteInvalidScreen());
          return;
        }
        logger.error("Could not save admin website link");
        await sendScreen(token, message.chat.id, adminStorageUnavailableScreen());
      }
      return;
    }

    if (target === "ios_app" || target === "android_app") {
      const type = target === "ios_app" ? "ios" as const : "android" as const;
      try {
        const savedUrl = await saveAppUrl(type, text, user.id);
        configuringCryptoAddress.delete(user.id);
        const [configuredMethods, websiteUrl, appUrls] = await Promise.all([
          getConfiguredPaymentMethods(),
          getWebsiteUrl(),
          getAppUrls(),
        ]);
        await sendScreen(
          token,
          message.chat.id,
          adminAppUrlSavedScreen(
            type,
            savedUrl,
            new Set(configuredMethods.map((method) => method.currencyCode)),
            Boolean(websiteUrl),
            Boolean(appUrls.iosUrl),
            Boolean(appUrls.androidUrl),
          ),
        );
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_app_url") {
          await sendScreen(token, message.chat.id, adminAppUrlInvalidScreen(type));
          return;
        }
        logger.error("Could not save app url");
        await sendScreen(token, message.chat.id, adminStorageUnavailableScreen());
      }
      return;
    }

    const code = target as CryptoCode;
    try {
      await saveCryptoPaymentAddress(code, text, user.id);
      configuringCryptoAddress.delete(user.id);
      const [configuredMethods, websiteUrl, appUrls] = await Promise.all([
        getConfiguredPaymentMethods(),
        getWebsiteUrl(),
        getAppUrls(),
      ]);
      await sendScreen(
        token,
        message.chat.id,
        adminAddressSavedScreen(
          code,
          new Set(configuredMethods.map((method) => method.currencyCode)),
          Boolean(websiteUrl),
          Boolean(appUrls.iosUrl),
          Boolean(appUrls.androidUrl),
        ),
      );
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_crypto_address") {
        await sendScreen(token, message.chat.id, adminAddressInvalidScreen(code as CryptoCode));
        return;
      }
      logger.error("Could not save crypto payment address");
      await sendScreen(token, message.chat.id, adminStorageUnavailableScreen());
    }
    return;
  }

  if (enteringTopUpAmountUserIds.has(user.id)) {
    enteringTopUpAmountUserIds.delete(user.id);
    const normalized = text.replace(/[$,\\s]/g, "");
    if (!/^\\d+(?:\\.\\d{1,2})?$/.test(normalized)) {
      await sendScreen(token, message.chat.id, invalidTopUpAmountScreen());
      return;
    }

    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < 50 || amount > 10_000) {
      await sendScreen(token, message.chat.id, invalidTopUpAmountScreen());
      return;
    }

    pendingTopUpAmounts.set(user.id, amount);
    await sendScreen(
      token,
      message.chat.id,
      cryptoCurrencySelectionScreen(amount),
    );
    return;
  }

  if (redeemingUserIds.has(user.id)) {
    redeemingUserIds.delete(user.id);
    await sendScreen(token, message.chat.id, redeemUnavailableScreen());
  }
}

async function handleUpdate(
  token: string,
  update: TelegramUpdate,
): Promise<void> {
  if (update.callback_query) {
    await handleCallback(token, update.callback_query);
    return;
  }

  if (update.message) {
    await handleMessage(token, update.message);
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pollUpdates(token: string): Promise<void> {
  let offset: number | undefined;

  while (true) {
    try {
      const updates = await callTelegram<TelegramUpdate[]>(
        token,
        "getUpdates",
        {
          ...(offset === undefined ? {} : { offset }),
          timeout: 30,
          allowed_updates: ["message", "callback_query"],
        },
      );

      for (const update of updates) {
        await handleUpdate(token, update);
        offset = update.update_id + 1;
      }
    } catch {
      logger.error("Telegram polling failed; retrying shortly");
      await wait(5000);
    }
  }
}

export function startTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    logger.warn("Telegram bot is not running: TELEGRAM_BOT_TOKEN is missing");
    return;
  }

  void (async () => {
    try {
      const userCommands = [
        { command: "start", description: "Main menu" },
        { command: "balance", description: "Wallet balance" },
        { command: "sip", description: "Your SIP account" },
        {
          command: "setcaller",
          description: "Set your caller ID, e.g. /setcaller 12125551234",
        },
        { command: "help", description: "How it works" },
        { command: "cancel", description: "Stop what you were typing" },
      ];
      await callTelegram(token, "setMyCommands", {
        commands: userCommands,
      });
      await callTelegram(token, "setMyCommands", {
        scope: { type: "chat", chat_id: ADMIN_TELEGRAM_ID },
        commands: [
          ...userCommands,
          { command: "admin", description: "Open admin settings" },
          { command: "get", description: "Download source code (admin only)" },
        ],
      });
      logger.info("Telegram bot command menu configured");
    } catch {
      logger.error("Could not configure the Telegram bot command menu");
    }

    void pollUpdates(token);
  })();
}
