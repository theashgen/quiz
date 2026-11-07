import { test, expect, type Page } from "@playwright/test";

async function home(page: Page) {
    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Big brains. Bigger vibes." }),
    ).toBeVisible();
}

async function join(page: Page, code: string, name: string) {
    await home(page);
    await page.getByLabel("Room code", { exact: true }).fill(code);
    await page
        .getByRole("button", { name: "Join a room", exact: true })
        .click();
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        code,
    );
    await page.getByLabel("Your name").fill(name);
    await page.getByRole("button", { name: "Join the room" }).click();
    await expect(
        page.getByRole("heading", { name: "A good time is on its way." }),
    ).toBeVisible();
}

test("phone layout, custom save/reuse, host-only play, and newer-tab takeover", async ({
    browser,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await home(page);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBeTruthy();
    await page.getByRole("button", { name: /^Create a room/ }).click();
    await page.getByRole("button", { name: "Your own questions" }).click();
    await page
        .getByLabel("Question text")
        .fill("Which option names the number two?");
    for (const [i, text] of ["One", "Two", "Three", "Four"].entries())
        await page
            .getByLabel(`Question 1, option ${"ABCD"[i]}`, { exact: true })
            .fill(text);
    await page
        .getByRole("radio", {
            name: "Question 1: option B is correct",
            exact: true,
        })
        .check();
    await page.getByLabel("Quiz title").fill("Browser saved test");
    await page.getByRole("button", { name: "Save a copy" }).click();
    await expect(
        page.getByText("Browser saved test", { exact: false }),
    ).toBeVisible();
    // Explicit saving survives a full browser refresh without cookies being used as quiz storage.
    await page.reload();
    await page.getByRole("button", { name: "Your own questions" }).click();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.getByLabel("Question text")).toHaveValue(
        "Which option names the number two?",
    );
    await page.getByRole("button", { name: "Add a question" }).click();
    const texts = page.getByLabel("Question text");
    await texts.nth(1).fill("Which option is a primary additive light color?");
    for (const [i, text] of ["Orange", "Pink", "Blue", "Brown"].entries())
        await page
            .getByLabel(`Question 2, option ${"ABCD"[i]}`, { exact: true })
            .fill(text);
    await page
        .getByRole("radio", {
            name: "Question 2: option C is correct",
            exact: true,
        })
        .check();
    await page.getByRole("button", { name: "Move question 2 up" }).click();
    await expect(texts.first()).toHaveValue(
        "Which option is a primary additive light color?",
    );
    await page.getByRole("button", { name: "Move question 1 down" }).click();
    await page.getByLabel("Your name").fill("Teacher");
    await page.getByRole("button", { name: "Create my room" }).click();
    await expect(page.locator(".room-code")).toBeVisible();
    const code = (await page.locator(".room-code").innerText()).slice(0, 6);
    const context = await browser.newContext({
        baseURL: new URL(page.url()).origin,
        ignoreHTTPSErrors: true,
        viewport: { width: 390, height: 844 },
    });
    const player = await context.newPage();
    await join(player, code, "Ada");
    await expect(page.getByText("Ada", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start the quiz" }).click();
    await expect(
        page.getByRole("heading", { name: "Let them cook." }),
    ).toBeVisible();
    await expect(page.locator(".answer-option")).toHaveCount(0);
    await expect(player.locator(".answer-option")).toHaveCount(4);
    expect(
        await player.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBeTruthy();
    // A second tab shares the cookie identity but must take over instead of creating another player.
    const newer = await context.newPage();
    await newer.goto("/room/" + code);
    await expect(newer.locator(".answer-option")).toHaveCount(4);
    await expect(
        player.getByRole("heading", {
            name: "This session is active in another tab.",
        }),
    ).toBeVisible();
    for (let i = 0; i < 2; i++) {
        await expect(
            newer.getByRole("button", { name: "Submit answer" }),
        ).toBeVisible();
        await newer.locator(".answer-option").first().click();
        await newer.getByRole("button", { name: "Submit answer" }).click();
        await expect(newer.locator(".answer-option.correct")).toHaveCount(1);
        await expect(newer.locator(".reveal-footer")).toContainText(
            "Correct answer:",
        );
        if (i === 0)
            await expect(
                newer.getByText("Question 2 of 2", { exact: true }),
            ).toBeVisible();
    }
    await expect(
        newer.getByRole("heading", { name: "The final leaderboard" }),
    ).toBeVisible();
    await expect(newer.locator(".leaderboard li")).toHaveCount(1);
    await expect(
        page.getByRole("heading", { name: "A round well hosted." }),
    ).toBeVisible();
    await newer
        .getByRole("button", { name: "Count me in for another" })
        .click();
    await expect(page.getByText("1 player wants to play again")).toBeVisible();
    await expect(
        newer
            .getByRole("status")
            .filter({ hasText: "Waiting for the host to set up" }),
    ).toBeVisible();
    const preparingNotice = newer.getByRole("status").filter({
        hasText: "Your host is setting up the next quiz",
    });
    await page.getByRole("button", { name: "Set up the next quiz" }).click();
    await expect(preparingNotice).toBeVisible();
    await page.getByRole("button", { name: "Back to results" }).click();
    await expect(preparingNotice).not.toBeVisible();
    await page.getByRole("button", { name: "Set up the next quiz" }).click();
    await expect(preparingNotice).toBeVisible();
    await page.getByRole("button", { name: "Open next lobby" }).click();
    await expect(preparingNotice).not.toBeVisible();
    await expect(
        newer.getByRole("heading", { name: "A good time is on its way." }),
    ).toBeVisible();
    await expect(newer.getByText("Ada (you)", { exact: true })).toBeVisible();
    await expect(
        player.getByRole("heading", {
            name: "This session is active in another tab.",
        }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
});

test("solo presets finish without a lobby and keep a personal score", async ({
    page,
}) => {
    await home(page);
    await page.getByRole("button", { name: "Play solo" }).click();
    await page.getByRole("button", { name: "Let’s play" }).click();
    for (let i = 1; i <= 5; i++) {
        await expect(
            page.getByText(`Question ${i} of 5`, { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Submit answer" }),
        ).toBeVisible();
        await page.locator(".answer-option").first().click();
        await page.getByRole("button", { name: "Submit answer" }).click();
        await expect(page.locator(".answer-option.correct")).toHaveCount(1);
    }
    await expect(
        page.getByRole("heading", { name: "Your result", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".big-score")).toContainText("/ 500");
    await expect(
        page.getByRole("button", { name: "Another solo round" }),
    ).toBeVisible();
});

test("saved quizzes get unique UUIDs when HTTP disables randomUUID", async ({
    page,
}) => {
    await page.addInitScript(() => {
        Object.defineProperty(crypto, "randomUUID", { value: undefined });
    });
    await page.goto("/create");
    await page.getByRole("button", { name: "Your own questions" }).click();
    await page.getByRole("button", { name: "Save a copy" }).click();
    await page.getByRole("button", { name: "Save a copy" }).click();
    await expect(
        page.getByRole("button", { name: "Open", exact: true }),
    ).toHaveCount(2);
    const ids: string[] = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("quiz.custom.v1")!).map(
            (quiz: { id: string }) => quiz.id,
        ),
    );
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
        expect(id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
    }
});

test("unavailable local storage shows a visible save failure without losing the editor", async ({
    page,
}) => {
    await page.addInitScript(() => {
        Storage.prototype.setItem = function () {
            throw new DOMException("Storage unavailable", "QuotaExceededError");
        };
    });
    await home(page);
    await page.getByRole("button", { name: /^Create a room/ }).click();
    await page.getByRole("button", { name: "Your own questions" }).click();
    await page.getByLabel("Question text").fill("Unsaved question");
    await page.getByRole("button", { name: "Save a copy" }).click();
    await expect(page.getByRole("alert")).toContainText(
        "Unable to save in this browser",
    );
    await expect(page.getByLabel("Question text")).toHaveValue(
        "Unsaved question",
    );
});
