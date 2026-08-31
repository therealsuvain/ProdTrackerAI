import { eq, lt } from "drizzle-orm";
import { db, localRecoveryItems, localRecoverySnapshots, syncCursors } from "@/db";
import { RecoverySnapshotSummary } from "@/types/recovery-snapshot";

export async function getSyncCursor(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(syncCursors)
    .where(eq(syncCursors.userId, userId))
    .limit(1);

  return row?.lastPulledAt ?? null;
}

export async function saveSyncCursor(
  userId: string,
  lastPulledAt: string,
): Promise<void> {
  await db
    .insert(syncCursors)
    .values({
      userId,
      lastPulledAt,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: syncCursors.userId,
      set: {
        lastPulledAt,
        updatedAt: new Date().toISOString(),
      },
    });
}

export async function clearSyncCursor(userId: string): Promise<void> {
  await db
    .delete(syncCursors)
    .where(eq(syncCursors.userId, userId));
}


export async function deleteExpiredRecoverySnapshot(): Promise<void> {
  const now = new Date().toISOString();

  const expired = await db
    .select({ id: localRecoverySnapshots.id })
    .from(localRecoverySnapshots)
    .where(lt(localRecoverySnapshots.expiresAt, now));

  if (expired.length === 0) return;

  await db.delete(localRecoverySnapshots);
}

export async function deleteRecoverySnapshot(): Promise<void> {
  await db.delete(localRecoverySnapshots);
}

export async function getRecoverySnapshotSummary(): Promise<
  RecoverySnapshotSummary | null
> {
  await deleteExpiredRecoverySnapshot();

  const [snapshot] = await db
    .select()
    .from(localRecoverySnapshots)
    .limit(1);

  if (!snapshot) return null;

  const itemRows = await db
    .select({ entityId: localRecoveryItems.entityId })
    .from(localRecoveryItems)
    .where(eq(localRecoveryItems.snapshotId, snapshot.id));

  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    expiresAt: snapshot.expiresAt,
    sourceUserId: snapshot.sourceUserId,
    sourceIsAnonymous: snapshot.sourceIsAnonymous,
    itemCount: itemRows.length,
  };
}

export async function getRecoverySnapshotItems(
  snapshotId: string,
) {
  await deleteExpiredRecoverySnapshot();

  return db
    .select()
    .from(localRecoveryItems)
    .where(eq(localRecoveryItems.snapshotId, snapshotId));
}

