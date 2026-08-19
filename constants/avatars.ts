export const AVATARS = {
  avatar_1: require("@/assets/avatars/avatar_1.png"),
  avatar_2: require("@/assets/avatars/avatar_2.png"),
  avatar_3: require("@/assets/avatars/avatar_3.png"),
  avatar_4: require("@/assets/avatars/avatar_4.png"),
  avatar_5: require("@/assets/avatars/avatar_5.png"),
  avatar_6: require("@/assets/avatars/avatar_6.png"),
  avatar_7: require("@/assets/avatars/avatar_7.png"),
  avatar_8: require("@/assets/avatars/avatar_8.png"),
  avatar_9: require("@/assets/avatars/avatar_9.png"),
  avatar_10: require("@/assets/avatars/avatar_10.png"),
  avatar_11: require("@/assets/avatars/avatar_11.png"),
  avatar_12: require("@/assets/avatars/avatar_12.png"),
} as const;

export type AvatarId = keyof typeof AVATARS;

export const DEFAULT_AVATAR_ID: AvatarId = "avatar_1";

export const AVATAR_IDS = Object.keys(AVATARS) as AvatarId[];

export function getAvatarSource(avatarId: string | null | undefined) {
  if (avatarId && avatarId in AVATARS) {
    return AVATARS[avatarId as AvatarId];
  }
  return AVATARS[DEFAULT_AVATAR_ID];
}