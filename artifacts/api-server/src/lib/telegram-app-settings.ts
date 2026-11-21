import { getBotSettingsCollection } from "@workspace/db";

const IOS_APP_URL_KEY = "ios_app_url";
const ANDROID_APP_URL_KEY = "android_app_url";
const MAX_URL_LENGTH = 512;

export function normalizeAppUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export async function getAppUrls(): Promise<{ iosUrl?: string; androidUrl?: string }> {
  const col = await getBotSettingsCollection();
  const [iosDoc, androidDoc] = await Promise.all([
    col.findOne({ key: IOS_APP_URL_KEY }),
    col.findOne({ key: ANDROID_APP_URL_KEY }),
  ]);
  return {
    iosUrl: iosDoc ? normalizeAppUrl(iosDoc.value) : undefined,
    androidUrl: androidDoc ? normalizeAppUrl(androidDoc.value) : undefined,
  };
}

export async function saveAppUrl(
  type: "ios" | "android",
  value: string,
  adminTelegramId: number
): Promise<string> {
  const normalized = normalizeAppUrl(value);
  if (!normalized) throw new Error("invalid_app_url");
  const key = type === "ios" ? IOS_APP_URL_KEY : ANDROID_APP_URL_KEY;
  const col = await getBotSettingsCollection();
  await col.updateOne(
    { key },
    {
      $set: {
        key,
        value: normalized,
        updatedBy: adminTelegramId,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  return normalized;
}
