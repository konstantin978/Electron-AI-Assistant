import { collection } from "./index.js";
import type { Memory } from "./types.js";

const MEMORIES = "memories";
const MAX_MEMORIES = 50;

const memoriesCollection = () => collection<Memory>(MEMORIES);

export const listMemories = async (limit = 20): Promise<Memory[]> => {
  return memoriesCollection()
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const addMemory = async (memory: Memory): Promise<void> => {
  await memoriesCollection().insertOne(memory);

  // Cap total count: prune oldest beyond MAX_MEMORIES
  const total = await memoriesCollection().countDocuments();
  if (total > MAX_MEMORIES) {
    const overflow = total - MAX_MEMORIES;
    const toDelete = await memoriesCollection()
      .find({})
      .sort({ createdAt: 1 })
      .limit(overflow)
      .toArray();
    const ids = toDelete.map((m) => m.id);
    await memoriesCollection().deleteMany({ id: { $in: ids } });
  }
};

export const deleteAllMemories = async (): Promise<void> => {
  await memoriesCollection().deleteMany({});
};
