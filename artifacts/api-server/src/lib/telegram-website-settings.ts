import { getBotSettingsCollection } from "@workspace/db";

const WEBSITE_URL_KEY = "website_url";
const MAX_WEBSITE_URL_LENGTH = 512;

export function normalizeWebsiteUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_WEBSITE_URL_LENGTH) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export async function getWebsiteUrl(): Promise<string | undefined> {
  const col = await getBotSettingsCollection();
  const setting = await col.findOne({ key: WEBSITE_URL_KEY });
  return setting ? normalizeWebsiteUrl(setting.value) : undefined;
}

export async function saveWebsiteUrl(
  value: string,
  adminTelegramId: number,
): Promise<string> {
  const websiteUrl = normalizeWebsiteUrl(value);
  if (!websiteUrl) throw new Error("invalid_website_url");

  const col = await getBotSettingsCollection();
  await col.updateOne(
    { key: WEBSITE_URL_KEY },
    {
      $set: {
        key: WEBSITE_URL_KEY,
        value: websiteUrl,
        updatedBy: adminTelegramId,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        // keep for upsert
      },
    },
    { upsert: true }
  );

  return websiteUrl;
}
