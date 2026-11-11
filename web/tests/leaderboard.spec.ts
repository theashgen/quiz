import { test, expect, type Page } from "@playwright/test";
import type { Snapshot } from "../src/types";

const players = [
    { id: "winner", name: "Claire", avatar: "memoji-58", score: 1242, rank: 1 },
    { id: "second", name: "Evander", avatar: "🦊", score: 1103, rank: 2 },
    { id: "third", name: "Kenton", avatar: "🐱", score: 1024, rank: 3 },
    {
        id: "me",
        name: "Zackary Romijn",
        avatar: "memoji-42",
        score: 987,
        rank: 4,
    },
    {
        id: "fifth",
        name: "Brittny Barringer",
        avatar: "🐸",
        score: 890,
        rank: 5,
    },
    {
        id: "sixth",
        name: "Krysta Kobayashi",
        avatar: "🐙",
        score: 678,
        rank: 6,
    },
];

async function showResults(
    page: Page,
    entries = players,
    participating = false,
) {
    const snapshot: Snapshot = {
        revision: 1,
        code: "POD123",
        roundId: "podium-round",
        status: "results",
        source: participating ? "preset" : "custom",
        solo: false,
        serverTime: Date.now(),
        expiresAt: Date.now() + 600000,
        me: "me",
        isHost: true,
        enrolled: participating,
        members: [],
        total: entries.length,
        finished: entries.length,
        replayCount: 0,
        preparingNextQuiz: false,
        leaderboard: entries,
        ...(participating
            ? {
                  personal: {
                      phase: "finished" as const,
                      number: 15,
                      total: 15,
                      deadline: 0,
                      revealUntil: 0,
                      score: 987,
                  },
              }
            : {}),
    };
    await page.route("**/api/rooms/POD123", (route) =>
        route.fulfill({ json: snapshot }),
    );
    await page.routeWebSocket(/\/api\/rooms\/POD123\/ws/, (socket) => {
        socket.send(JSON.stringify({ type: "snapshot", snapshot }));
    });
    await page.goto("/room/POD123");
    await expect(
        page.getByRole("heading", { name: "The final leaderboard" }),
    ).toBeVisible();
}

const tenPlayers = [
    ...players,
    {
        id: "seventh",
        name: "Arjun Mehta",
        avatar: "memoji-9",
        score: 570,
        rank: 7,
    },
    {
        id: "eighth",
        name: "Maya Chen",
        avatar: "memoji-12",
        score: 520,
        rank: 8,
    },
    {
        id: "ninth",
        name: "Noah Williams",
        avatar: "memoji-7",
        score: 440,
        rank: 9,
    },
    {
        id: "tenth",
        name: "Sofia Patel",
        avatar: "memoji-13",
        score: 380,
        rank: 10,
    },
];

test("result separators use only their intended edges on desktop and mobile", async ({
    page,
}) => {
    await showResults(page, tenPlayers, true);
    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [selector, expected] of [
            [".replay-actions", [1, 0, 0, 0]],
            [".results-score", width > 1000 ? [0, 0, 0, 1] : [0, 0, 0, 0]],
        ] as const) {
            const element = page.locator(selector);
            await expect(element).toBeVisible();
            expect(
                await element.evaluate((node) => {
                    const style = getComputedStyle(node);
                    return [
                        style.borderTopWidth,
                        style.borderRightWidth,
                        style.borderBottomWidth,
                        style.borderLeftWidth,
                    ].map(parseFloat);
                }),
            ).toEqual(expected);
        }
    }
});

test("laptop results use two columns with score and replay actions in view", async ({
    page,
}) => {
    await showResults(page, tenPlayers, true);
    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 1280, height: 720 },
        { width: 1024, height: 768 },
    ]) {
        await page.setViewportSize(viewport);
        const stage = await page.locator(".leaderboard-stage").boundingBox();
        const standings = await page
            .locator(".leaderboard-standings")
            .boundingBox();
        const board = await page.locator(".podium-board").boundingBox();
        const results = await page.locator(".results-page").boundingBox();
        expect(stage!.x + stage!.width).toBeLessThan(standings!.x);
        expect(stage!.y).toBeCloseTo(standings!.y, 0);
        expect(board!.width).toBeGreaterThanOrEqual(results!.width - 1);
        await expect(page.locator(".big-score")).toBeInViewport({ ratio: 1 });
        await expect(
            page.getByRole("button", { name: "Set up the next quiz" }),
        ).toBeInViewport({ ratio: 1 });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        await expect(page.locator(".leaderboard li")).toHaveCount(10);
        const lastPlayer = page.locator(".ranked-players li").last();
        await lastPlayer.scrollIntoViewIfNeeded();
        await expect(lastPlayer).toBeInViewport({ ratio: 1 });
        await expect(
            page.getByRole("button", { name: "Set up the next quiz" }),
        ).toBeInViewport({ ratio: 1 });
    }
});

test("mobile keeps the podium above naturally scrolling rankings", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await showResults(page, tenPlayers, true);
    const stage = await page.locator(".leaderboard-stage").boundingBox();
    const standings = await page
        .locator(".leaderboard-standings")
        .boundingBox();
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(standings!.y + 1);
    await expect(page.locator(".ranked-players")).toHaveCSS(
        "overflow-y",
        "visible",
    );
    await page.locator(".ranked-players li").last().scrollIntoViewIfNeeded();
    await expect(
        page.getByText("Sofia Patel", { exact: true }),
    ).toBeInViewport();
});

test("large laptop rooms scroll their rankings without moving replay controls", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const largeRoom = Array.from({ length: 50 }, (_, index) => ({
        id: `player-${index}`,
        name: `Player ${index + 1}`,
        avatar: `memoji-${index + 1}`,
        score: 1500 - index * 20,
        rank: index + 1,
    }));
    await showResults(page, largeRoom, true);
    const rankings = page.getByRole("list", { name: "Remaining players" });
    expect(
        await rankings.evaluate(
            (element) => element.scrollHeight > element.clientHeight,
        ),
    ).toBeTruthy();
    await rankings.focus();
    await page.keyboard.press("End");
    await expect(page.getByText("Player 50", { exact: true })).toBeInViewport();
    await expect(
        page.getByRole("button", { name: "Set up the next quiz" }),
    ).toBeInViewport({ ratio: 1 });
});

test("podium follows the reference order with all players and personal highlighting", async ({
    page,
}) => {
    await showResults(page);
    await expect(page.locator(".leaderboard li")).toHaveCount(6);
    await expect(
        page.getByRole("list", { name: "Top players" }).getByRole("listitem"),
    ).toHaveCount(3);
    await expect(
        page
            .getByRole("list", { name: "Remaining players" })
            .getByRole("listitem"),
    ).toHaveCount(3);
    await expect(page.locator(".ranked-players .me")).toContainText(
        "Zackary Romijn",
    );
    await expect(page.locator(".podium-place-1")).toContainText("1,242");
    await expect(page.locator(".podium-place-1 img")).toHaveAttribute(
        "src",
        "/avatars/tapback/58.webp",
    );
    await expect(page.locator(".podium-place-2 img")).toHaveAttribute(
        "src",
        "/avatars/tapback/2.webp",
    );
    await expect(page.locator(".ranked-players .me img")).toHaveAttribute(
        "src",
        "/avatars/tapback/42.webp",
    );
    await expect
        .poll(() =>
            page
                .locator(".leaderboard img")
                .evaluateAll((images) =>
                    images.every(
                        (image) =>
                            (image as HTMLImageElement).complete &&
                            (image as HTMLImageElement).naturalWidth > 0,
                    ),
                ),
        )
        .toBeTruthy();
    const winner = await page
        .locator(".podium-place-1 .podium-step")
        .boundingBox();
    const second = await page
        .locator(".podium-place-2 .podium-step")
        .boundingBox();
    const third = await page
        .locator(".podium-place-3 .podium-step")
        .boundingBox();
    expect(second!.x).toBeLessThan(winner!.x);
    expect(winner!.x).toBeLessThan(third!.x);
    expect(winner!.height).toBeGreaterThan(second!.height);
    expect(second!.height).toBeGreaterThan(third!.height);
    await expect(
        page.getByRole("button", { name: "Set up the next quiz" }),
    ).toBeEnabled();
});

test("leaderboard fits phones and desktops with long names", async ({
    page,
}) => {
    await showResults(
        page,
        players.map((player) => ({
            ...player,
            name: "ExtraordinarilyLongPlayerNameXYZ",
        })),
    );
    for (const viewport of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1280, height: 720 },
    ]) {
        await page.setViewportSize(viewport);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        for (const entry of await page
            .locator(".podium-name,.list-player-name")
            .all()) {
            expect(
                await entry.evaluate(
                    (element) => element.scrollWidth <= element.clientWidth,
                ),
            ).toBeTruthy();
        }
        const replay = page.getByRole("button", {
            name: "Set up the next quiz",
        });
        await replay.scrollIntoViewIfNeeded();
        await expect(replay).toBeInViewport({ ratio: 1 });
    }
});

for (const count of [0, 1, 2, 3]) {
    test(`leaderboard handles ${count} players without invented podium entries`, async ({
        page,
    }) => {
        await showResults(page, players.slice(0, count));
        await expect(page.locator(".leaderboard li")).toHaveCount(count);
        await expect(page.locator(".ranked-players")).toHaveCount(0);
        if (count === 0)
            await expect(
                page.getByText("No player scores for this round."),
            ).toBeVisible();
    });
}

test("two tied mobile players retain the original podium and centered results", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await showResults(
        page,
        [players[0], players[3]].map((player) => ({
            ...player,
            score: 200,
            rank: 1,
        })),
        true,
    );
    await expect(page.locator(".compact-podium")).toHaveCount(0);
    await expect(page.locator(".winner-crown")).toHaveCount(1);
    await expect(page.locator(".podium-step").first()).toBeVisible();
    await expect(page.locator(".page-heading")).toHaveCSS(
        "text-align",
        "center",
    );
    await expect(page.locator(".leaderboard-stage")).toHaveCSS(
        "border-top-width",
        "0px",
    );
    const first = await page
        .locator(".winner-podium > li .podium-step")
        .first()
        .boundingBox();
    const second = await page
        .locator(".winner-podium > li .podium-step")
        .last()
        .boundingBox();
    expect(first!.height).toBeGreaterThan(second!.height);
    expect(first!.x).toBeGreaterThan(second!.x);
    await expect(page.getByText("0 players want to play again")).toBeVisible();
    const primary = page.getByRole("button", { name: "Set up the next quiz" });
    const secondary = page.getByRole("button", {
        name: "Count me in for another",
    });
    await primary.scrollIntoViewIfNeeded();
    expect((await primary.boundingBox())!.y).toBeGreaterThan(
        (await secondary.boundingBox())!.y,
    );
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBeTruthy();
});
