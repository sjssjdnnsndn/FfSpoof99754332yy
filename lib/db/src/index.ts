import { MongoClient, Db, Collection } from "mongodb";
import * as schema from "./schema";

// Support multiple env var names for MongoDB connection
const mongoUri =
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  process.env.MONGO_URL ||
  process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error(
    "MONGODB_URI (or DATABASE_URL) must be set. Did you forget to provision a database? Provided example: mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0"
  );
}

const mongoUriString: string = mongoUri;

// Allow mongodb://, mongodb+srv://, or postgresql:// check - but we enforce mongo now
if (mongoUriString.startsWith("postgresql://") || mongoUriString.startsWith("postgres://")) {
  console.warn(
    "[db] WARNING: DATABASE_URL looks like Postgres, but this project is now configured for MongoDB. Use MONGODB_URI instead."
  );
}

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let connectPromise: Promise<Db> | null = null;

function getDbNameFromUri(uri: string): string | undefined {
  try {
    const url = new URL(uri);
    // pathname is like "/dbname?query" or "/"
    const pathname = url.pathname.replace(/^\//, "").split("?")[0];
    if (pathname) return pathname;
    // Try searchParams dbName alternative
    return undefined;
  } catch {
    return undefined;
  }
}

async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    client = new MongoClient(mongoUriString);
    await client.connect();
    const dbName = getDbNameFromUri(mongoUriString) || "ffspoof";
    dbInstance = client.db(dbName);
    console.log(`[db] Connected to MongoDB database: ${dbName}`);

    // Ensure indexes
    await Promise.all([
      dbInstance.collection("telegram_users").createIndex({ telegramId: 1 }, { unique: true }).catch(() => {}),
      dbInstance.collection("telegram_bot_settings").createIndex({ key: 1 }, { unique: true }).catch(() => {}),
      dbInstance.collection("crypto_payment_methods").createIndex({ currencyCode: 1 }, { unique: true }).catch(() => {}),
      dbInstance.collection("top_up_quotes").createIndex({ telegramId: 1, createdAt: -1 }).catch(() => {}),
    ]);

    return dbInstance;
  })();

  return connectPromise;
}

// Synchronous getters that return a promise-based collection wrapper
// We expose async helpers so callers can `await getCollection()`
export async function getTelegramUsersCollection(): Promise<Collection<schema.TelegramUser>> {
  const db = await getDb();
  return db.collection<schema.TelegramUser>("telegram_users");
}

export async function getBotSettingsCollection(): Promise<Collection<schema.TelegramBotSetting>> {
  const db = await getDb();
  return db.collection<schema.TelegramBotSetting>("telegram_bot_settings");
}

export async function getCryptoPaymentMethodsCollection(): Promise<Collection<schema.CryptoPaymentMethod>> {
  const db = await getDb();
  return db.collection<schema.CryptoPaymentMethod>("crypto_payment_methods");
}

export async function getTopUpQuotesCollection(): Promise<Collection<schema.TopUpQuote>> {
  const db = await getDb();
  return db.collection<schema.TopUpQuote>("top_up_quotes");
}

// For backwards compatibility, export a `db` object with helper methods
// This is NOT drizzle - we provide mongo helpers
export const mongo = {
  getDb,
  getTelegramUsersCollection,
  getBotSettingsCollection,
  getCryptoPaymentMethodsCollection,
  getTopUpQuotesCollection,
};

// Keep pool export as dummy for any leftover imports (will throw if used)
export const pool = {
  query: () => { throw new Error("pool.query is not supported with MongoDB - use mongo.getDb() instead"); }
} as any;

// Re-export schema types
export * from "./schema";

// Also export a generic `db` alias for easier migration
export { getDb as dbConnection };
