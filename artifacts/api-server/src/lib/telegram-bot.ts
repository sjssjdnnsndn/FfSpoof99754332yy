import { logger } from "./logger";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
}

interface TelegramUser {
  first_name?: string;
  last_name?: string;
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
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

const startKeyboard = {
  inline_keyboard: [
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
};

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function welcomeMessage(user?: TelegramUser): string {
  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    "Bio Bhaiya";
  const separator = "━━━━━━━━━━━━━━━━━━━━";

  return [
    `<b>👋 Welcome back, ${escapeHtml(name)}!</b>`,
    separator,
    "📋 Plan ▹ None",
    "⌛ Status ▹ No active subscription",
    "💰 Wallet ▹ $0.00",
    separator,
    "",
    "<i>💡 Pick a plan or redeem a code to get started.</i>",
  ].join("\n");
}

async function handleUpdate(
  token: string,
  update: TelegramUpdate,
): Promise<void> {
  const text = update.message?.text;
  if (text && /^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    await callTelegram(token, "sendMessage", {
      chat_id: update.message!.chat.id,
      text: welcomeMessage(update.message!.from),
      parse_mode: "HTML",
      reply_markup: startKeyboard,
    });
  }

  if (update.callback_query) {
    await callTelegram(token, "answerCallbackQuery", {
      callback_query_id: update.callback_query.id,
    });
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
