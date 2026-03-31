import { eq, desc, asc } from "drizzle-orm";
import { db, messages } from "@/db";
import type { Message } from "@/types/chat";
import type { MessageRow, MessageInsert } from "@/db/schema";

// ─── type converters ──────────────────────────────────────────────────────────

/** DB row → application Message. Called on every read. */
function rowToMessage(row: MessageRow): Message {
    return {
        id: row.id,
        sender: row.sender,
        type: row.type,
        text: row.text,
        timestamp: row.timestamp,
        pendingActions: row.pendingActions ? JSON.parse(row.pendingActions) : undefined,
        isConfirmed: row.isConfirmed ?? undefined,
        isExpired: row.isExpired ?? undefined,
        updatedAt: row.updatedAt,
    };
}

/** Application Message → DB insert shape. Called on every write. */
function messageToInsert(message: Message): MessageInsert {
    const now = new Date().toISOString();
    return {
        id: message.id,
        sender: message.sender,
        type: message.type,
        text: message.text,
        timestamp: message.timestamp,
        pendingActions: message.pendingActions? JSON.stringify(message.pendingActions): null,
        isConfirmed: message.isConfirmed ?? null,
        isExpired: message.isExpired ?? null,
        updatedAt: now, // always stamp updatedAt to now on any write
    };
}

export async function getAllMessages(): Promise<Message[]> {
    const rows = await db
        .select()
        .from(messages)
        .orderBy(desc(messages.timestamp));
    return rows.map(rowToMessage);
}

export async function insertMessage(message: Message): Promise<Message> {
    const insert = messageToInsert(message);
    await db.insert(messages).values(insert);
    // Return with the exact timestamps that were written
    return rowToMessage({ ...insert } as MessageRow);
}

export async function bulkInsertMessages(messageList: Message[]): Promise<void> {
    if (messageList.length === 0) return;

    await db.transaction(async (tx) => {
        for (const message of messageList) {
            await tx
                .insert(messages)
                .values(messageToInsert(message))
                .onConflictDoNothing(); // safe to re-run migration
        }
    });
}
export async function countMessages(): Promise<number> {
    const result = await db.select({ id: messages.id }).from(messages);
    return result.length;
}

/* export async function getMessageById(id: string): Promise<Message | null> {
    const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.id, id))
        .limit(1);
    return rows.length > 0 ? rowToMessage(rows[0]) : null;
}

export async function updateMessage(message: Message): Promise<Message> {
    const insert = messageToInsert(message);
    await db
        .update(messages)
        .set({
            ...insert,
            updatedAt: new Date().toISOString(), // explicit — messageToInsert also sets it
        })
        .where(eq(messages.id, message.id));
    return rowToMessage({ ...insert } as MessageRow);
}

export async function deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
}
 */