import { logger } from "./logger";
import { db, telegramUsers } from "@workspace/db";
import {
  accountScreen,
  faqAnswerScreen,
  faqScreen,
  insufficientBalanceFor,
  invoicesScreen,
  nineAppScreen,
  plansScreen,
  redeemCodeScreen,
  redeemUnavailableScreen,
  topUpUnavailableScreen,
  walletHistoryScreen,
  walletScreen,
  websiteNotConfiguredText,
  welcomeScreen,
  type BotScreen,
} from "./telegram-bot-screens";
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
  const [profile] = await db
    .insert(telegramUsers)
    .values({
      telegramId: user.id,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      username: user.username ?? null,
    })
    .onConflictDoUpdate({
      target: telegramUsers.telegramId,
      set: {
        firstName: user.first_name,
        lastName: user.last_name ?? null,
        username: user.username ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!profile) {
    throw new Error("Telegram profile could not be saved");
  }
  return profile;
}

const redeemingUserIds = new Set<number>();

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
  if (callback.data === "website") {
    await answerCallback(token, callback, websiteNotConfiguredText());
    return;
  }

  await answerCallback(token, callback);

  const chatId = callback.message?.chat.id;
  if (!chatId) return;

  switch (callback.data) {
    case "menu":
      redeemingUserIds.delete(callback.from.id);
      await sendScreen(
        token,
        chatId,
        welcomeScreen(callback.from.first_name, callback.from.last_name),
      );
      return;
    case "buy_plan":
      await sendScreen(token, chatId, plansScreen());
      return;
    case "redeem_code":
      redeemingUserIds.add(callback.from.id);
      await sendScreen(token, chatId, redeemCodeScreen());
      return;
    case "redeem_cancel":
      redeemingUserIds.delete(callback.from.id);
      await sendScreen(
        token,
        chatId,
        welcomeScreen(callback.from.first_name, callback.from.last_name),
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
    case "faq_subscriptions":
    case "faq_sip":
    case "faq_app":
    case "faq_payments":
    case "faq_dtmf":
    case "faq_refund":
      await sendScreen(token, chatId, faqAnswerScreen(callback.data));
      return;
    case "top_up":
      await sendScreen(token, chatId, topUpUnavailableScreen());
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
    try {
      await saveTelegramUser(user);
    } catch {
      logger.error("Could not save Telegram user profile");
    }
    await sendScreen(
      token,
      message.chat.id,
      welcomeScreen(user.first_name, user.last_name),
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
      await callTelegram(token, "setMyCommands", {
        commands: [{ command: "start", description: "Open the main menu" }],
      });
      logger.info("Telegram bot command menu configured");
    } catch {
      logger.error("Could not configure the Telegram bot command menu");
    }

    void pollUpdates(token);
  })();
}
