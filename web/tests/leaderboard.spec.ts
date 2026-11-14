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
    solo = false,
    overrides: Partial<Snapshot> = {},
) {
    const snapshot: Snapshot = {
        revision: 1,
        code: "POD123",
        roundId: "podium-round",
        status: "results",
        source: participating ? "preset" : "custom",
        solo,
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
        ...overrides,
    };
    await page.route("**/api/rooms/POD123", (route) =>
        route.fulfill({ json: snapshot }),
    );
    await page.routeWebSocket(/\/api\/rooms\/POD123\/ws/, (socket) => {
        socket.send(JSON.stringify({ type: "snapshot", snapshot }));
        socket.onMessage((message) => {
            const command = JSON.parse(String(message));
            if (command.type !== "replay") return;
            snapshot.revision++;
            snapshot.replayCount++;
            snapshot.members = [
                {
                    id: "me",
                    name: "Me",
                    avatar: "🐱",
                    host: snapshot.isHost,
                    playing: true,
                    finished: true,
                    replay: true,
                },
            ];
            socket.send(
                JSON.stringify({
                    type: "snapshot",
                    snapshot,
                    requestId: command.requestId,
                }),
            );
        });
    });
    await page.goto("/room/POD123");
    if (solo) {
        await expect(page.locator(".winner-podium")).toBeVisible();
    } else {
        await expect(
            page.getByRole("heading", {
                name: /^(The final leaderboard|Final leaderboard)$/,
                exact: true,
            }),
        ).toBeVisible();
    }
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

for (const width of [320, 390, 820, 1440]) {
    test(`solo reuses the shared podium layout at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        await showResults(page, [{ ...players[3], rank: 1 }], true, true);
        await expect(page.locator(".results-page")).toHaveClass(
            /podium-results/,
        );
        await expect(page.locator(".results-page")).toHaveClass(/solo-results/);
        await expect(page.locator(".page-heading")).toHaveCount(0);
        await expect(page.locator(".leaderboard-heading")).toHaveCount(0);
        await expect(page.locator(".result-star")).toBeHidden();
        await expect(page.locator(".leaderboard-stage")).toHaveCSS(
            "background-color",
            "rgb(255, 255, 255)",
        );
        await expect(page.locator(".leaderboard-stage")).toHaveCSS(
            "border-radius",
            "28px",
        );
        await expect(
            page.getByRole("list", { name: "Top players" }),
        ).toHaveCount(1);
        await expect(page.locator(".winner-podium > li")).toHaveCount(1);
        await expect(page.locator(".podium-name")).toHaveText("Zackary Romijn");
        await expect(page.locator(".podium-score")).toContainText("987");
        await expect(page.locator(".ranked-players")).toHaveCount(0);
        await expect(page.locator(".leaderboard-standings")).toHaveCount(0);
        const winner = await page.locator(".winner-podium > li").boundingBox();
        const stage = await page.locator(".leaderboard-stage").boundingBox();
        expect(winner!.x + winner!.width / 2).toBeCloseTo(
            stage!.x + stage!.width / 2,
            0,
        );
        await page
            .getByRole("button", { name: "Another solo round" })
            .scrollIntoViewIfNeeded();
        await expect(
            page.getByRole("button", { name: "Another solo round" }),
        ).toBeInViewport();
        await expect(
            page.getByRole("button", { name: "Count me in for another" }),
        ).toHaveCount(0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        await page.getByRole("button", { name: "Another solo round" }).click();
        await expect(page).toHaveURL(/\/solo$/);
    });
}

test("result separators use only their intended edges on desktop and mobile", async ({
    page,
}) => {
    await showResults(page, tenPlayers, true);
    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [selector, expected] of [
            [".replay-actions", [1, 0, 0, 0]],
            [
                width <= 740 ? ".personal-result" : ".results-score",
                width > 1000 ? [0, 0, 0, 1] : [0, 0, 0, 0],
            ],
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

test("desktop podium stays balanced with visible ranks and a shared baseline", async ({
    page,
}) => {
    await showResults(page, tenPlayers, true);
    for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 1024, height: 768 },
    ]) {
        await page.setViewportSize(viewport);
        await page.screenshot({
            path: test
                .info()
                .outputPath(`podium-${viewport.width}-${viewport.height}.png`),
            animations: "disabled",
        });
        const heading = await page
            .locator(".leaderboard-heading")
            .boundingBox();
        const note = await page
            .locator(".leaderboard-final-note")
            .boundingBox();
        const podium = await page.locator(".winner-podium").boundingBox();
        const winner = await page.locator(".podium-place-1").boundingBox();
        const topGap = winner!.y - (heading!.y + heading!.height);
        const bottomGap = note!.y - (podium!.y + podium!.height);
        expect(topGap).toBeLessThan(180);
        expect(bottomGap).toBeGreaterThanOrEqual(-1);
        const baseline = winner!.y + winner!.height;
        for (const step of await page.locator(".podium-step").all()) {
            const box = await step.boundingBox();
            const rank = await step.locator("strong").boundingBox();
            expect(box!.y + box!.height).toBeCloseTo(baseline, 0);
            expect(rank!.y).toBeGreaterThanOrEqual(box!.y);
            expect(rank!.y + rank!.height).toBeLessThanOrEqual(
                box!.y + box!.height,
            );
            await expect(step).toBeInViewport({ ratio: 1 });
            expect(
                await step.evaluate(
                    (element) => getComputedStyle(element).backgroundImage,
                ),
            ).not.toContain("transparent");
        }
    }
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
        await page.setViewportSize({ width: 390, height: 844 });
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

for (const width of [320, 360, 390, 430]) {
    test(`mobile ${width}px has one heading, reachable actions and a focusable personal rank`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        const entries = Array.from({ length: 150 }, (_, index) => ({
            id: index === 100 ? "me" : `player-${index}`,
            name:
                index === 100
                    ? "My extraordinarily long player name"
                    : `Player ${index + 1}`,
            avatar: "🐱",
            rank: index + 1,
            score: 100000 - index,
        }));
        await showResults(page, entries, true, false, { isHost: false });
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Final leaderboard",
        );
        await expect(
            page.getByRole("heading", { name: "The final leaderboard" }),
        ).toHaveCount(0);
        await expect(page.locator(".personal-result")).toContainText(
            "#101 of 150",
        );
        const replay = page.getByRole("button", {
            name: "Count me in for another",
        });
        await expect(replay).toBeInViewport({ ratio: 1 });
        await page.getByRole("button", { name: "Find me" }).click();
        const me = page.locator(".ranked-players li.me");
        await expect(me).toBeFocused();
        await expect(me).toBeInViewport({ ratio: 1 });
        await expect(
            page.locator(".mobile-results-summary [role=status]"),
        ).toContainText("101 of 150");
        await expect(replay).toBeInViewport({ ratio: 1 });
        await page
            .locator(".ranked-players li")
            .last()
            .scrollIntoViewIfNeeded();
        const last = await page
            .locator(".ranked-players li")
            .last()
            .boundingBox();
        const dock = await page.locator(".replay-actions").boundingBox();
        expect(last!.y + last!.height).toBeLessThanOrEqual(dock!.y);
        await replay.click();
        await expect(
            page.getByText("You’re in! Waiting for the host", { exact: false }),
        ).toBeVisible();
        await expect(replay).toHaveCount(0);
        await expect(
            page.getByRole("button", { name: "Back to home" }),
        ).toBeInViewport({ ratio: 1 });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
    });
}

test("mobile host states preserve setup and participating host opt-in", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await showResults(
        page,
        tenPlayers.filter((entry) => entry.id !== "me"),
    );
    await expect(page.locator(".personal-result")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Find me" })).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Count me in for another" }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Set up the next quiz" }),
    ).toBeInViewport({ ratio: 1 });
    await page.unrouteAll({ behavior: "wait" });
    await showResults(page, tenPlayers, true);
    await expect(
        page.getByRole("button", { name: "Set up the next quiz" }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
        page.getByRole("button", { name: "Count me in for another" }),
    ).toBeInViewport({ ratio: 1 });
});

test("mobile Find me targets the podium and tied ranks retain list semantics", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const entries = players.slice(0, 4).map((entry, index) => ({
        ...entry,
        rank: index >= 2 ? 3 : index + 1,
    }));
    await showResults(page, entries, true, false, { me: "third" });
    await page.getByRole("button", { name: "Find me" }).click();
    await expect(page.locator(".podium-player.me")).toBeFocused();
    await expect(page.locator(".podium-player.me")).toBeInViewport({
        ratio: 1,
    });
    await expect(page.locator(".ranked-players")).toHaveAttribute("start", "3");
    await expect(page.locator(".ranked-players li")).toHaveAttribute(
        "value",
        "3",
    );
    await expect(page.locator(".ranked-players")).not.toHaveAttribute(
        "tabindex",
        "0",
    );
});

test("short mobile screens and enlarged text keep all results and actions reachable", async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await showResults(
        page,
        tenPlayers.map((entry) => ({
            ...entry,
            name: "ExtraordinarilyLongPlayerNameXYZ",
            score: 999999,
        })),
        true,
    );
    // Exercise enlarged text without scaling the viewport geometry or hiding overflow.
    await page.addStyleTag({
        content:
            ".mobile-results { font-size: 200%; } .mobile-results :is(button, p, strong, small, span, h1, h2, h3) { font-size: inherit !important; }",
    });
    for (const selector of [
        ".ranked-players li:last-child",
        ".replay-opt-in",
        ".replay-actions button:last-child",
    ]) {
        const target = page.locator(selector);
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeInViewport({ ratio: 1 });
    }
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBeTruthy();
});

test("mobile preparation status keeps the player's results available", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await showResults(page, tenPlayers, true, false, {
        isHost: false,
        preparingNextQuiz: true,
        members: [
            {
                id: "me",
                name: "Me",
                avatar: "🐱",
                host: false,
                playing: true,
                finished: true,
                replay: true,
            },
        ],
    });
    await expect(
        page.getByText("Your host is setting up the next quiz…"),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Final leaderboard", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Count me in for another" }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Back to home" }),
    ).toBeInViewport({ ratio: 1 });
});

test("mid-height mobile dock leaves standings and host actions reachable", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await showResults(page, tenPlayers, true);
    for (const name of [
        "Count me in for another",
        "Set up the next quiz",
        "Back to home",
    ]) {
        await expect(page.getByRole("button", { name })).toBeInViewport({
            ratio: 1,
        });
    }
    const last = page.locator(".ranked-players li").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport({ ratio: 1 });
    const row = await last.boundingBox();
    const dock = await page.locator(".replay-actions").boundingBox();
    expect(row!.y + row!.height).toBeLessThanOrEqual(dock!.y);
    await expect(
        page.getByRole("button", { name: "Find me" }),
    ).toHaveAccessibleName("Find me");
});

for (const width of [320, 360, 390, 430]) {
    test(`enlarged podium text stays inside each column at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        await showResults(
            page,
            tenPlayers.map((entry) => ({ ...entry, score: 999999 })),
            true,
        );
        await page.addStyleTag({
            content:
                ".mobile-results { font-size: 200%; } .mobile-results :is(button, p, strong, small, span, h1, h2, h3) { font-size: inherit !important; }",
        });
        await expect(page.locator(".mobile-results")).toHaveClass(
            /flow-results/,
        );
        for (const player of await page.locator(".winner-podium > li").all()) {
            const overflow = await player.evaluate((node) => {
                const column = node.getBoundingClientRect();
                const errors: string[] = [];
                for (const label of node.querySelectorAll(
                    ".podium-score, .podium-you",
                )) {
                    const walker = document.createTreeWalker(
                        label,
                        NodeFilter.SHOW_TEXT,
                    );
                    while (walker.nextNode()) {
                        if (!walker.currentNode.textContent?.trim()) continue;
                        const range = document.createRange();
                        range.selectNodeContents(walker.currentNode);
                        for (const rect of range.getClientRects()) {
                            if (
                                rect.left < column.left - 1 ||
                                rect.right > column.right + 1
                            )
                                errors.push(label.className);
                        }
                    }
                }
                return errors;
            });
            expect(overflow).toEqual([]);
        }
        await page.getByRole("button", { name: "Next round actions" }).click();
        await expect(
            page.getByRole("button", { name: "Count me in for another" }),
        ).toBeFocused();
        await expect(
            page.getByRole("button", { name: "Count me in for another" }),
        ).toBeInViewport({ ratio: 1 });
    });
}

test("short-screen shortcut reaches replay after 150 players and preserves confirmation focus", async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const entries = Array.from({ length: 150 }, (_, index) => ({
        id: index === 100 ? "me" : `p-${index}`,
        name: `Player ${index + 1}`,
        avatar: "🐱",
        score: 1000 - index,
        rank: index + 1,
    }));
    await showResults(page, entries, true, false, { isHost: false });
    const shortcut = page.getByRole("button", { name: "Next round actions" });
    await shortcut.scrollIntoViewIfNeeded();
    await shortcut.click();
    const replay = page.getByRole("button", {
        name: "Count me in for another",
    });
    await expect(replay).toBeFocused();
    await expect(replay).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Enter");
    await expect(page.locator(".waiting")).toBeFocused();
    await expect(page.locator(".waiting")).toHaveCSS(
        "outline-color",
        "rgb(140, 60, 13)",
    );
});
