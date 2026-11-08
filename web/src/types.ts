export type Question = {
    id?: string;
    text: string;
    options: string[];
    correct: number;
};

export type Account = {
    id: string;
    name: string;
    email: string;
    role: "teacher" | "student";
};

export type Setup = {
    source: "preset" | "custom";
    categories: string[];
    count: number;
    timer: number;
    participate: boolean;
    name: string;
    avatar: string;
    questions?: Question[];
};

export type Catalog = {
    categories: Record<string, number>;
    avatars: string[];
    lengths: number[];
    timers: number[];
    provenance: string;
};

export type Receipt = {
    attemptId: string;
    questionId: string;
    choice: number | null;
    correct: number;
    points: number;
    acceptedAt: number;
};

export type Member = {
    id: string;
    name: string;
    avatar: string;
    host: boolean;
    playing: boolean;
    finished: boolean;
    replay: boolean;
};

export type Personal = {
    phase: "question" | "reveal" | "finished";
    number: number;
    total: number;
    deadline: number;
    revealUntil: number;
    question?: { id: string; text: string; options: string[] };
    receipt?: Receipt;
    score?: number;
};

export type Snapshot = {
    revision: number;
    code: string;
    roundId: string;
    status: "lobby" | "active" | "results" | "expired";
    source: string;
    solo: boolean;
    serverTime: number;
    expiresAt: number;
    me: string;
    isHost: boolean;
    enrolled: boolean;
    members: Member[];
    total: number;
    finished: number;
    replayCount: number;
    preparingNextQuiz: boolean;
    personal?: Personal;
    leaderboard?: {
        id: string;
        name: string;
        avatar: string;
        score: number;
        rank: number;
    }[];
};

export type Command = {
    type: string;
    requestId: string;
    roundId: string;
    questionId?: string;
    choice?: number;
    setup?: Setup;
};

export async function api<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch("/api" + path, {
        method: body === undefined ? "GET" : "POST",
        headers:
            body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
        throw Object.assign(new Error(data.error ?? "Something went wrong"), {
            status: response.status,
        });
    return data as T;
}
