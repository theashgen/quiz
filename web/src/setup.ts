import type { Question, Setup } from "./types";
import { defaultAvatar } from "./avatars";

export const normalizeRoomCode = (value: string): string =>
    value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);

export const blank = (): Question => ({
    text: "",
    options: ["", "", "", ""],
    correct: 0,
});

export const base = (): Setup => ({
    source: "preset",
    categories: ["Science"],
    count: 5,
    timer: 10,
    participate: true,
    name: "Host",
    avatar: defaultAvatar,
    questions: [blank()],
});
