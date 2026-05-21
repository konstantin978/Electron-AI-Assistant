import { MongoClient, type Db, type Collection } from "mongodb";
import { log } from "../utils/logger.js";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017";
const DB_NAME = "electron_ai_assistant";

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectDb = async (): Promise<Db> => {
  if (db) return db;

  client = new MongoClient(MONGO_URL, {
    serverSelectionTimeoutMS: 3000,
  });
  await client.connect();
  db = client.db(DB_NAME);
  log.info(`MongoDB connected: ${MONGO_URL}/${DB_NAME}`);
  return db;
};

export const closeDb = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};

export const collection = <T extends Record<string, unknown>>(
  name: string,
): Collection<T> => {
  if (!db) throw new Error("DB not connected. Call connectDb() first.");
  return db.collection<T>(name);
};
