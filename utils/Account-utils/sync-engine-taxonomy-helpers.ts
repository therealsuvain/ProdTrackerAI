import { categories, db, tags } from "@/db";
import { mergeCategoryInTransaction, mergeTagInTransaction } from "@/db/repositories/tags-and-category-repository";
import { eq, inArray } from "drizzle-orm";
import { inputToLowerCaseAndTrim } from "../common-utils";
import { supabase } from "./supabase-client";
import { and, isNull } from "drizzle-orm/sql";
import ca from "zod/v4/locales/ca.cjs";


export function entityWins(
    a: { id: string; createdAt: string },
    b: { id: string; createdAt: string },
): boolean {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();

    if (aTime !== bTime) {
        return aTime < bTime;
    }

    return a.id < b.id;
}

export function isUniqueViolation(error: any): boolean {
    return error?.code === "23505";
}

export async function getCloudActiveCategory(
    userId: string,
    normalizedName: string,
) {
    const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", userId)
        .eq("normalized_name", normalizedName)
        .is("deleted_at", null)
        .maybeSingle();

    if (error) throw error;

    return data;
}



export async function reconcileCategoryCollision(
    userId: string,
    local: any,
    remote: any,
): Promise<void> {
    const localWins = entityWins(
        {
            id: local.id,
            createdAt: local.createdAt,
        },
        {
            id: remote.id,
            createdAt: remote.created_at,
        },
    );

    const combinedCount =
        Number(local.count ?? 0) +
        Number(remote.count ?? 0);

    const now = new Date().toISOString();

    if (localWins) {
        // Local category survives.
        //console.log("Category: local won")
        await db.transaction(async (tx) => {
            await tx
                .update(categories)
                .set({
                    count: combinedCount,
                    updatedAt: now,
                    syncedAt: null,
                    mergedIntoId: null,
                })
                .where(eq(categories.id, local.id));

            // Keep the remote loser locally as a tombstone so we retain the mapping.
            //console.log("Category: local winner made active")
            await tx
                .insert(categories)
                .values({
                    id: remote.id,
                    name: remote.name,
                    normalizedName: inputToLowerCaseAndTrim(remote.name),
                    color: remote.color,
                    icon: remote.icon,
                    count: remote.count,
                    createdAt: remote.created_at,
                    updatedAt: now,
                    deletedAt: now,
                    syncedAt: now,
                    mergedIntoId: local.id,
                })
                .onConflictDoUpdate({
                    target: categories.id,
                    set: {
                        deletedAt: now,
                        updatedAt: now,
                        syncedAt: now,
                        mergedIntoId: local.id,
                    },
                });
            //console.log("Category: remote loser added and inactive")
        });

        // Tell cloud that the remote category lost.
        const { error: loserError } = await supabase
            .from("categories")
            .update({
                deleted_at: now,
                updated_at: now,
                merged_into_id: local.id,
            })
            .eq("id", remote.id)
            .eq("user_id", userId);
        //console.log("Category:remote loser updated with local loser")
        if (loserError) throw loserError;

        // Push the surviving local category with the merged count.
        const [winner] = await db
            .select()
            .from(categories)
            .where(eq(categories.id, local.id))
            .limit(1);

        const { error: winnerError } = await supabase
            .from("categories")
            .upsert({
                id: winner.id,
                user_id: userId,
                name: winner.name,
                color: winner.color,
                icon: winner.icon,
                count: winner.count,
                created_at: winner.createdAt,
                updated_at: winner.updatedAt,
                deleted_at: null,
                merged_into_id: null,
            });
        //console.log("Category: remote winner updated with local winner")
        if (winnerError) throw winnerError;

        await db
            .update(categories)
            .set({ syncedAt: new Date().toISOString() })
            .where(
                inArray(categories.id, [local.id, remote.id]),
            );

        return;
    }
    //console.log("Category: remote won")
    // Remote category wins.
    await db.transaction(async (tx) => {
        // Make the remote winner available locally.
        await tx
            .update(tags)
            .set({
                deletedAt: now,
                updatedAt: now,
                syncedAt: null,
                mergedIntoId: remote.id,
            })
            .where(eq(tags.id, local.id));

        //console.log("Category: local loser made inactive")
        await tx
            .insert(categories)
            .values({
                id: remote.id,
                name: remote.name,
                normalizedName: inputToLowerCaseAndTrim(remote.name),
                color: remote.color,
                icon: remote.icon,
                count: remote.count,
                createdAt: remote.created_at,
                updatedAt: remote.updated_at,
                deletedAt: null,
                syncedAt: remote.updated_at,
                mergedIntoId: null,
            })
            .onConflictDoUpdate({
                target: categories.id,
                set: {
                    name: remote.name,
                    normalizedName: inputToLowerCaseAndTrim(remote.name),
                    color: remote.color,
                    icon: remote.icon,
                    count: remote.count,
                    createdAt: remote.created_at,
                    updatedAt: remote.updated_at,
                    deletedAt: null,
                    mergedIntoId: null,
                    syncedAt: remote.updated_at,
                },
            });
        //console.log("Category: remote winner made active")
        await mergeCategoryInTransaction(
            tx,
            remote.id,
            local.id,
            combinedCount,
        );
    });

    const [winner] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, remote.id))
        .limit(1);

    const [loser] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, local.id))
        .limit(1);

    // Update winner in cloud.
    const { error: winnerError } = await supabase
        .from("categories")
        .upsert({
            id: winner.id,
            user_id: userId,
            name: winner.name,
            color: winner.color,
            icon: winner.icon,
            count: winner.count,
            created_at: winner.createdAt,
            updated_at: winner.updatedAt,
            deleted_at: null,
            merged_into_id: null,
        });
    //console.log("Category: remote winner updated with local winner")
    if (winnerError) throw winnerError;

    // Publish the local loser tombstone.
    const { error: loserError } = await supabase
        .from("categories")
        .upsert({
            id: loser.id,
            user_id: userId,
            name: loser.name,
            color: loser.color,
            icon: loser.icon,
            count: loser.count,
            created_at: loser.createdAt,
            updated_at: loser.updatedAt,
            deleted_at: loser.deletedAt,
            merged_into_id: loser.mergedIntoId,
        });
    //console.log("Category: remote loser updated with local loser")
    if (loserError) throw loserError;

    const syncedNow = new Date().toISOString();

    await db
        .update(categories)
        .set({ syncedAt: syncedNow })
        .where(
            inArray(categories.id, [winner.id, loser.id]),
        );
}

export async function applyRemoteMergedCategory(
    userId: string,
    remote: any,
): Promise<void> {
    const loserId = remote.id;
    const winnerId = remote.merged_into_id;
    if (!winnerId) {
        throw new Error(
            `Merged Category ${loserId} has no merged_into_id`,
        );
    }

    if (loserId === winnerId) {
        throw new Error(
            `Invalid category merge: loser and winner are the same ID (${loserId})`,
        );
    }
    let [winner] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, winnerId))
        .limit(1);

    let [loser] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, loserId))
        .limit(1);
    // Winner isn't local yet — fetch it from cloud.

    if (
        loser &&
        loser.deletedAt !== null &&
        loser.mergedIntoId === winnerId &&
        winner &&
        winner.deletedAt === null
    ) {
        //console.log("Categopry: all done already skipping applyMerge")
        return;
    }

    let remoteWinner = null;

    if (!winner || winner.deletedAt !== null) {
        //console.log("Category: !winner || winner.deletedAt !== null is true")
        const { data, error } = await supabase
            .from("categories")
            .select("*")
            .eq("user_id", userId)
            .eq("id", winnerId)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new Error(
                `Merged category ${loserId} points to missing winner ${winnerId}`,
            );
        }
        remoteWinner = data;
    }
    //console.log("Category: remoteWinner", remoteWinner)
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
        /*
         * If winner is not already active locally, we must retire
         * the local loser BEFORE inserting/reactivating the winner.
         *
         * Otherwise the local partial unique index on normalizedName
         * will reject the winner.
         */
        if (
            (!winner || winner.deletedAt !== null) &&
            loser &&
            loser.id !== winnerId &&
            loser.deletedAt === null
        ) {
            await tx
                .update(categories)
                .set({
                    deletedAt: now,
                    updatedAt: now,
                    syncedAt: null,
                    mergedIntoId: winnerId,
                })
                .where(eq(categories.id, loser.id));
        }
        //console.log("Category: loser is inactive now")
        // Create/reactivate the actual winner.
        if (!winner || winner.deletedAt !== null) {
            await tx
                .insert(categories)
                .values({
                    id: winnerId,
                    name: remoteWinner.name,
                    normalizedName: inputToLowerCaseAndTrim(
                        remoteWinner.name,
                    ),
                    color: remoteWinner.color,
                    icon: remoteWinner.icon,
                    count: remoteWinner.count,
                    createdAt: remoteWinner.created_at,
                    updatedAt: remoteWinner.updated_at,
                    deletedAt: null,
                    mergedIntoId: null,
                    syncedAt: remoteWinner.updated_at,
                })
                .onConflictDoUpdate({
                    target: categories.id,
                    set: {
                        name: remoteWinner.name,
                        normalizedName: inputToLowerCaseAndTrim(
                            remoteWinner.name,
                        ),
                        count: remoteWinner.count,
                        createdAt: remoteWinner.created_at,
                        updatedAt: remoteWinner.updated_at,
                        deletedAt: null,
                        mergedIntoId: null,
                        syncedAt: remoteWinner.updated_at,
                    },
                });

            //console.log("Cateogyr: winner is active now", winner)
        }
        /*
         * We have the local loser, so migrate its references into
         * the winner. mergeTagInTransaction also recalculates the
         * winner count and turns the loser into a tombstone.
         */
        if (loser) {
            //console.log("Category: loser was local , merging it into winnder")
            await mergeCategoryInTransaction(
                tx,
                winnerId,
                loserId,
            );

            await tx
                .update(categories)
                .set({
                    syncedAt: now,
                })
                .where(
                    inArray(categories.id, [winnerId, loserId]),
                );

            return;
        }
        // This merge was already represented by cloud, so don't
        // make the locally-migrated rows dirty again.

        //! ON PULLING COUNT IS NOT UPDATED FOR COLLIDING FUCKS
        /*
         * We didn't have the loser locally. Preserve the remote
         * tombstone so the merge relationship exists locally too.
         */
        ////console.log("cateogry: loser wasnt local , adding it")
        await tx
            .insert(categories)
            .values({
                id: loserId,
                name: remote.name,
                normalizedName: inputToLowerCaseAndTrim(remote.name),
                color: remote.color,
                icon: remote.icon,
                count: remote.count,
                createdAt: remote.created_at,
                updatedAt: remote.updated_at,
                deletedAt: remote.deleted_at,
                mergedIntoId: winnerId,
                syncedAt: remote.updated_at,
            })
            .onConflictDoUpdate({
                target: categories.id,
                set: {
                    deletedAt: remote.deleted_at,
                    updatedAt: remote.updated_at,
                    mergedIntoId: winnerId,
                    syncedAt: remote.updated_at,
                },
            });
    });

    /*      await db.insert(categories).values({
             id: data.id,
             name: data.name,
             normalizedName: inputToLowerCaseAndTrim(data.name),
             color: data.color,
             icon: data.icon,
             count: data.count,
             createdAt: data.created_at,
             updatedAt: data.updated_at,
             deletedAt: data.deleted_at ?? null,
             mergedIntoId: data.merged_into_id ?? null,
             syncedAt: data.updated_at,
         });
 
         [winner] = await db
             .select()
             .from(categories)
             .where(eq(categories.id, winnerId))
             .limit(1);
     }
 
     const [loser] = await db
         .select()
         .from(categories)
         .where(eq(categories.id, remote.id))
         .limit(1);
 
     if (!loser) {
         // We never had this category locally.
         await db.insert(categories).values({
             id: remote.id,
             name: remote.name,
             normalizedName: inputToLowerCaseAndTrim(remote.name),
             color: remote.color,
             icon: remote.icon,
             count: remote.count,
             createdAt: remote.created_at,
             updatedAt: remote.updated_at,
             deletedAt: remote.deleted_at,
             mergedIntoId: winnerId,
             syncedAt: remote.updated_at,
         });
 
         return;
     }
 
     const extraLocalCount = Math.max(
         0,
         Number(loser.count) - Number(remote.count),
     );
 
     await db.transaction(async (tx) => {
         await mergeCategoryInTransaction(
             tx,
             winnerId,
             loser.id,
             Number(winner.count) + extraLocalCount,
         );
     }); */
}


export async function getCloudActiveTag(
    userId: string,
    normalizedName: string,
) {
    const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", userId)
        .eq("normalized_name", normalizedName)
        .is("deleted_at", null)
        .maybeSingle();

    if (error) throw error;

    return data;
}

export async function reconcileTagCollision(
    userId: string,
    local: any,
    remote: any,
): Promise<void> {
    const localWins = entityWins(
        {
            id: local.id,
            createdAt: local.createdAt,
        },
        {
            id: remote.id,
            createdAt: remote.created_at,
        },
    );

    const combinedCount =
        Number(local.count ?? 0) +
        Number(remote.count ?? 0);

    const now = new Date().toISOString();
    if (localWins) {
        // Local tag survives.
        //console.log("local won")
        await db.transaction(async (tx) => {
            await tx
                .update(tags)
                .set({
                    count: combinedCount,
                    updatedAt: now,
                    syncedAt: null,
                    mergedIntoId: null,
                })
                .where(eq(tags.id, local.id));

            // Keep the remote loser locally as a tombstone so we retain the mapping.
            //console.log("local winner made active")
            await tx
                .insert(tags)
                .values({
                    id: remote.id,
                    name: remote.name,
                    normalizedName: inputToLowerCaseAndTrim(remote.name),
                    count: remote.count,
                    createdAt: remote.created_at,
                    updatedAt: now,
                    deletedAt: now,
                    syncedAt: now,
                    mergedIntoId: local.id,
                })
                .onConflictDoUpdate({
                    target: tags.id,
                    set: {
                        deletedAt: now,
                        updatedAt: now,
                        syncedAt: now,
                        mergedIntoId: local.id,
                    },
                });
            await mergeTagInTransaction(
                tx,
                local.id,
                remote.id,
                combinedCount,
            );
            //console.log("remote loser added and inactive")
        });

        // Tell cloud that the remote tag lost.
        const { error: loserError } = await supabase
            .from("tags")
            .update({
                deleted_at: now,
                updated_at: now,
                merged_into_id: local.id,
            })
            .eq("id", remote.id)
            .eq("user_id", userId);
        //console.log("remote loser updated with local loser")
        if (loserError) throw loserError;

        // Push the surviving local tag with the merged count.
        const [winner] = await db
            .select()
            .from(tags)
            .where(eq(tags.id, local.id))
            .limit(1);

        const { error: winnerError } = await supabase
            .from("tags")
            .upsert({
                id: winner.id,
                user_id: userId,
                name: winner.name,
                count: winner.count,
                created_at: winner.createdAt,
                updated_at: winner.updatedAt,
                deleted_at: null,
                merged_into_id: null,
            });
        //console.log("remote winner updated with local winner")
        if (winnerError) throw winnerError;



        await db
            .update(tags)
            .set({ syncedAt: new Date().toISOString() })
            .where(
                inArray(tags.id, [local.id, remote.id]),
            );

        return;
    }
    //console.log("remote won")
    // Remote tag wins.
    await db.transaction(async (tx) => {
        // Make the remote winner available locally.
        await tx
            .update(tags)
            .set({
                deletedAt: now,
                updatedAt: now,
                syncedAt: null,
                mergedIntoId: remote.id,
            })
            .where(eq(tags.id, local.id));

        //console.log("local loser made inactive")
        await tx
            .insert(tags)
            .values({
                id: remote.id,
                name: remote.name,
                normalizedName: inputToLowerCaseAndTrim(remote.name),
                count: remote.count,
                createdAt: remote.created_at,
                updatedAt: remote.updated_at,
                deletedAt: null,
                syncedAt: remote.updated_at,
                mergedIntoId: null,
            })
            .onConflictDoUpdate({
                target: tags.id,
                set: {
                    name: remote.name,
                    normalizedName: inputToLowerCaseAndTrim(remote.name),
                    count: remote.count,
                    createdAt: remote.created_at,
                    updatedAt: remote.updated_at,
                    deletedAt: null,
                    mergedIntoId: null,
                    syncedAt: remote.updated_at,
                },
            });
        //console.log("remote winner made active")
        await mergeTagInTransaction(
            tx,
            remote.id,
            local.id,
            combinedCount,
        );
    });

    const [winner] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, remote.id))
        .limit(1);

    const [loser] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, local.id))
        .limit(1);

    // Update winner in cloud.
    const { error: winnerError } = await supabase
        .from("tags")
        .upsert({
            id: winner.id,
            user_id: userId,
            name: winner.name,
            count: winner.count,
            created_at: winner.createdAt,
            updated_at: winner.updatedAt,
            deleted_at: null,
            merged_into_id: null,
        });
    //console.log("remote winner updated with local winner")
    if (winnerError) throw winnerError;

    // Publish the local loser tombstone.
    const { error: loserError } = await supabase
        .from("tags")
        .upsert({
            id: loser.id,
            user_id: userId,
            name: loser.name,
            count: loser.count,
            created_at: loser.createdAt,
            updated_at: loser.updatedAt,
            deleted_at: loser.deletedAt,
            merged_into_id: loser.mergedIntoId,
        });
    //console.log("remote loser updated with local loser")
    if (loserError) throw loserError;

    const syncedNow = new Date().toISOString();

    await db
        .update(tags)
        .set({ syncedAt: syncedNow })
        .where(
            inArray(tags.id, [winner.id, loser.id]),
        );
}
/**
 * Let me go through your new version, I think its a bit wrong , or am i gettign confused.

0. So we pull data from cloud, and then go row by row, if a row has a merged_into_id field then applyRemoteMergedTag is called , meaning its only called for the remote loser
1. So that means winner = remote.merged_into_id. Your function then first checks if winner is already local , if the winner isnt local or if the winner is local and is soft deleted , we enter the first if (!winner || winner.deletedAt !== null)
   1. Then we check if loser is local by matching on the normal name where deleted at is null, if we find the local loser and its not winner based on this if (localLoser && localLoser.id !== winnerId), but if we see the parent if this if is only entered either there isnt a local winner or if there is its deleted at is not null, so the second ifs second logical expresssion can never be false, so its of no use?? Probable mistake #1.
      1. Then we calculate the finalCount , i dont why used the formula you used but lets move on. Then you first update localloser and sets deletedAt: now, updatedAt: now,  syncedAt: null, mergedIntoId: winnerId matcing on id, which makes sense. But then you do a insert insert(tags)
                    .values({
                        id: remote.id === winnerId ? remote.id : winnerId,
                        name: remote.merged_into_id
                            ? inputToLowerCaseAndTrim(remote.name) === normalizedName
                                ? remote.name
                                : remote.name
                            : remote.name,
                        normalizedName,
                        count: remote.count,
         This has me so confused, id = remote.id === winnerId ? remote.id : winnerId, huh? but winnerId is remote.merged_into_id, how will they ever be the same, doesnt the loser only get this field set, should i read for merged_into_id setting logic again?
 */
/**
 * This function is called when remote has a merged_into_id field, meaning , the function will always be passed with remote loser row
 * when being called from sync-engine cloud pull
 */
// export async function applyRemoteMergedTag(
//     userId: string,
//     remote: any,
// ): Promise<void> {
//     const winnerId = remote.merged_into_id;
//     const normalizedName = inputToLowerCaseAndTrim(remote.name);
//     let [winner] = await db
//         .select()
//         .from(tags)
//         .where(eq(tags.id, winnerId))
//         .limit(1);

//     // Winner isn't local yet — fetch it from cloud.
//     if (!winner || winner.deletedAt !== null) {

//         const [localLoser] = await db
//             .select()
//             .from(tags)
//             .where(
//                 and(
//                     eq(tags.normalizedName, normalizedName),
//                     isNull(tags.deletedAt),
//                 ),
//             )
//             .limit(1);

//         if (localLoser && localLoser.id !== winnerId) {
//             const finalCount =
//                 Number(remote.count ?? 0) +
//                 Math.max(
//                     0,
//                     Number(localLoser.count ?? 0) - Number(remote.count ?? 0),
//                 );

//             const now = new Date().toISOString();

//             await db.transaction(async (tx) => {
//                 // IMPORTANT:
//                 // Retire local loser first so the active-name unique index
//                 // allows the winner to be inserted.
//                 await tx
//                     .update(tags)
//                     .set({
//                         deletedAt: now,
//                         updatedAt: now,
//                         syncedAt: null,
//                         mergedIntoId: winnerId,
//                     })
//                     .where(eq(tags.id, localLoser.id));

//                 // Insert/reactivate the remote winner.
//                 await tx
//                     .insert(tags)
//                     .values({
//                         id: remote.id === winnerId ? remote.id : winnerId,
//                         name: remote.merged_into_id
//                             ? inputToLowerCaseAndTrim(remote.name) === normalizedName
//                                 ? remote.name
//                                 : remote.name
//                             : remote.name,
//                         normalizedName,
//                         count: remote.count,
//                         createdAt: remote.created_at,
//                         updatedAt: remote.updated_at,
//                         deletedAt: null,
//                         mergedIntoId: null,
//                         syncedAt: remote.updated_at,
//                     })
//                     .onConflictDoUpdate({
//                         target: tags.id,
//                         set: {
//                             name: remote.name,
//                             normalizedName,
//                             count: remote.count,
//                             createdAt: remote.created_at,
//                             updatedAt: remote.updated_at,
//                             deletedAt: null,
//                             mergedIntoId: null,
//                             syncedAt: remote.updated_at,
//                         },
//                     });
//                 await mergeTagInTransaction(
//                     tx,
//                     winnerId,
//                     localLoser.id,
//                     finalCount,
//                 );
//             });

//             return;
//         }

//         /*  const { data, error } = await supabase
//              .from("tags")
//              .select("*")
//              .eq("user_id", userId)
//              .eq("id", winnerId)
//              .maybeSingle();

//          if (error) throw error;
//          if (!data) return;

//          await db.insert(tags).values({
//              id: data.id,
//              name: data.name,
//              normalizedName: inputToLowerCaseAndTrim(data.name),
//              count: data.count,
//              createdAt: data.created_at,
//              updatedAt: data.updated_at,
//              deletedAt: data.deleted_at ?? null,
//              mergedIntoId: data.merged_into_id ?? null,
//              syncedAt: data.updated_at,
//          });

//          [winner] = await db
//              .select()
//              .from(tags)
//              .where(eq(tags.id, winnerId))
//              .limit(1);
//      }

//      const [loser] = await db
//          .select()
//          .from(tags)
//          .where(eq(tags.id, remote.id))
//          .limit(1);

//      if (!loser) {
//          // We never had this category locally.
//          await db.insert(tags).values({
//              id: remote.id,
//              name: remote.name,
//              normalizedName: inputToLowerCaseAndTrim(remote.name),
//              count: remote.count,
//              createdAt: remote.created_at,
//              updatedAt: remote.updated_at,
//              deletedAt: remote.deleted_at,
//              mergedIntoId: winnerId,
//              syncedAt: remote.updated_at,
//          });

//          return; 
//      }

//      const extraLocalCount = Math.max(
//          0,
//          Number(loser.count) - Number(remote.count),
//      );

//      await db.transaction(async (tx) => {
//          await mergeTagInTransaction(
//              tx,
//              winnerId,
//              loser.id,
//              Number(winner.count) + extraLocalCount,
//          );
//      });*/
//         await db
//             .insert(tags)
//             .values({
//                 id: winnerId,
//                 name: remote.name,
//                 normalizedName,
//                 count: remote.count,
//                 createdAt: remote.created_at,
//                 updatedAt: remote.updated_at,
//                 deletedAt: null,
//                 mergedIntoId: null,
//                 syncedAt: remote.updated_at,
//             })
//             .onConflictDoUpdate({
//                 target: tags.id,
//                 set: {
//                     name: remote.name,
//                     normalizedName,
//                     count: remote.count,
//                     createdAt: remote.created_at,
//                     updatedAt: remote.updated_at,
//                     deletedAt: null,
//                     mergedIntoId: null,
//                     syncedAt: remote.updated_at,
//                 },
//             });

//         [winner] = await db
//             .select()
//             .from(tags)
//             .where(eq(tags.id, winnerId))
//             .limit(1);
//     }

//     const [loser] = await db
//         .select()
//         .from(tags)
//         .where(eq(tags.id, remote.id))
//         .limit(1);

//     // We never had the loser locally.
//     if (!loser) {
//         await db.insert(tags).values({
//             id: remote.id,
//             name: remote.name,
//             normalizedName,
//             count: remote.count,
//             createdAt: remote.created_at,
//             updatedAt: remote.updated_at,
//             deletedAt: remote.deleted_at,
//             mergedIntoId: winnerId,
//             syncedAt: remote.updated_at,
//         });

//         return;
//     }

//     const finalCount =
//         Number(winner.count ?? 0) +
//         Math.max(
//             0,
//             Number(loser.count ?? 0) - Number(remote.count ?? 0),
//         );

//     await db.transaction(async (tx) => {
//         await mergeTagInTransaction(
//             tx,
//             winnerId,
//             loser.id,
//             finalCount,
//         );
//     });
// }

export async function applyRemoteMergedTag(
    userId: string,
    remote: any,
): Promise<void> {
    const loserId = remote.id;
    const winnerId = remote.merged_into_id;
    //console.log("winnderid", winnerId, "loserid", loserId)
    if (!winnerId) {
        throw new Error(
            `Merged tag ${loserId} has no merged_into_id`,
        );
    }

    if (loserId === winnerId) {
        throw new Error(
            `Invalid tag merge: loser and winner are the same ID (${loserId})`,
        );
    }

    // Check whether winner already exists locally.
    let [winner] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, winnerId))
        .limit(1);

    // Check whether the loser already exists locally.
    let [loser] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, loserId))
        .limit(1);

    // If the winner isn't locally active, fetch the actual winner
    // from the cloud.
    if (
        loser &&
        loser.deletedAt !== null &&
        loser.mergedIntoId === winnerId &&
        winner &&
        winner.deletedAt === null
    ) {
        //console.log("all done already skipping applyMerge")
        return;
    }
    let remoteWinner = null;

    if (!winner || winner.deletedAt !== null) {
        //console.log("!winner || winner.deletedAt !== null is true")
        const { data, error } = await supabase
            .from("tags")
            .select("*")
            .eq("user_id", userId)
            .eq("id", winnerId)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            throw new Error(
                `Merged tag ${loserId} points to missing winner ${winnerId}`,
            );
        }

        remoteWinner = data;
    }
    //console.log("remoteWinner", remoteWinner)
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
        /*
         * If winner is not already active locally, we must retire
         * the local loser BEFORE inserting/reactivating the winner.
         *
         * Otherwise the local partial unique index on normalizedName
         * will reject the winner.
         */
        if (
            (!winner || winner.deletedAt !== null) &&
            loser &&
            loser.id !== winnerId &&
            loser.deletedAt === null
        ) {
            await tx
                .update(tags)
                .set({
                    deletedAt: now,
                    updatedAt: now,
                    syncedAt: null,
                    mergedIntoId: winnerId,
                })
                .where(eq(tags.id, loser.id));
        }
        //console.log("loser is inactive now")
        // Create/reactivate the actual winner.
        if (!winner || winner.deletedAt !== null) {
            await tx
                .insert(tags)
                .values({
                    id: winnerId,
                    name: remoteWinner.name,
                    normalizedName: inputToLowerCaseAndTrim(
                        remoteWinner.name,
                    ),
                    count: remoteWinner.count,
                    createdAt: remoteWinner.created_at,
                    updatedAt: remoteWinner.updated_at,
                    deletedAt: null,
                    mergedIntoId: null,
                    syncedAt: remoteWinner.updated_at,
                })
                .onConflictDoUpdate({
                    target: tags.id,
                    set: {
                        name: remoteWinner.name,
                        normalizedName: inputToLowerCaseAndTrim(
                            remoteWinner.name,
                        ),
                        count: remoteWinner.count,
                        createdAt: remoteWinner.created_at,
                        updatedAt: remoteWinner.updated_at,
                        deletedAt: null,
                        mergedIntoId: null,
                        syncedAt: remoteWinner.updated_at,
                    },
                });

            [winner] = await tx
                .select()
                .from(tags)
                .where(eq(tags.id, winnerId))
                .limit(1);

            //console.log("winner is active now", winner)
        }

        /*
         * We have the local loser, so migrate its references into
         * the winner. mergeTagInTransaction also recalculates the
         * winner count and turns the loser into a tombstone.
         */
        if (loser) {
            //console.log("loser was local , merging it into winnder")
            await mergeTagInTransaction(
                tx,
                winnerId,
                loserId,
            );

            await tx
                .update(tags)
                .set({
                    syncedAt: now,
                })
                .where(
                    inArray(tags.id, [winnerId, loserId]),
                );

            return;
        }

        /*
         * We didn't have the loser locally. Preserve the remote
         * tombstone so the merge relationship exists locally too.
         */
        //console.log("loser wasnt local , adding it")
        await tx
            .insert(tags)
            .values({
                id: loserId,
                name: remote.name,
                normalizedName: inputToLowerCaseAndTrim(remote.name),
                count: remote.count,
                createdAt: remote.created_at,
                updatedAt: remote.updated_at,
                deletedAt: remote.deleted_at,
                mergedIntoId: winnerId,
                syncedAt: remote.updated_at,
            })
            .onConflictDoUpdate({
                target: tags.id,
                set: {
                    deletedAt: remote.deleted_at,
                    updatedAt: remote.updated_at,
                    mergedIntoId: winnerId,
                    syncedAt: remote.updated_at,
                },
            });
    });
}