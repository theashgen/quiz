export const avatarCount = 58;
export const defaultAvatar = "memoji-1";

const legacyAvatars = ["🦉", "🦊", "🐼", "🐸", "🐙", "🐯"];

export function avatarNumber(value: string): number {
    const legacyIndex = legacyAvatars.indexOf(value);
    if (legacyIndex !== -1) return legacyIndex + 1;
    const match = /^memoji-([1-9]\d*)$/.exec(value);
    const index = match ? Number(match[1]) : 1;
    return index >= 1 && index <= avatarCount ? index : 1;
}

export function avatarSource(value: string): string {
    return `/avatars/tapback/${avatarNumber(value)}.webp`;
}
