import { test, expect } from "@playwright/test";
import { test as teacherTest } from "./teacher-fixture";

teacherTest(
    "host copies an invite and a guest joins through its URL",
    async ({ page, context, browser, baseURL }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.goto("/create");
        await page.getByRole("button", { name: "Create my room" }).click();
        await expect(
            page.getByRole("heading", { name: "Your people" }),
        ).toBeVisible();
        const code = new URL(page.url()).pathname.split("/").pop()!;
        const inviteURL = new URL("/join/" + code, baseURL).href;
        await expect(page.getByLabel("Invite players with a link")).toHaveValue(
            inviteURL,
        );
        await page.getByRole("button", { name: "Copy invite link" }).click();
        await expect(page.getByRole("status")).toHaveText(
            "Invite link copied.",
        );
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
            inviteURL,
        );

        const guestContext = await browser.newContext({
            baseURL,
            ignoreHTTPSErrors: true,
        });
        try {
            const guest = await guestContext.newPage();
            await guest.goto(inviteURL);
            await expect(
                guest.getByLabel("Room code", { exact: true }),
            ).toHaveValue(code);
            await expect(guest.getByLabel("Your name")).toBeFocused();
            await expect(guest.getByLabel("Your name")).toHaveValue("");
            await guest.getByLabel("Your name").fill("Invite Guest");
            await guest.getByRole("button", { name: "Join the room" }).click();
            await expect(guest).toHaveURL(
                new URL("/room/" + code, baseURL).href,
            );
            await expect(
                guest.getByRole("heading", { name: "Your people" }),
            ).toBeVisible();
            await expect(
                page.getByText("Invite Guest", { exact: true }),
            ).toBeVisible();
            await expect(
                guest.getByRole("button", { name: "Copy invite link" }),
            ).toHaveCount(0);
            await guest.reload();
            await expect(
                guest.getByRole("heading", { name: "Your people" }),
            ).toBeVisible();
            await page.setViewportSize({ width: 320, height: 700 });
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBeTruthy();
        } finally {
            await guestContext.close();
        }
    },
);

teacherTest(
    "clipboard failure leaves a selectable invite link",
    async ({ page }) => {
        await page.goto("/create");
        await page.getByRole("button", { name: "Create my room" }).click();
        const link = page.getByLabel("Invite players with a link");
        await expect(link).toBeVisible();
        await page.evaluate(() => {
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    writeText: async () => {
                        throw new Error("Clipboard denied");
                    },
                },
            });
        });
        await page.getByRole("button", { name: "Copy invite link" }).click();
        await expect(page.getByRole("alert")).toHaveText(
            "Copy unavailable. Select and copy the invite link above.",
        );
        await expect(
            page.getByText("Invite link copied.", { exact: true }),
        ).toHaveCount(0);
        await link.focus();
        const selected = await link.evaluate((element: HTMLInputElement) =>
            element.value.slice(
                element.selectionStart ?? 0,
                element.selectionEnd ?? 0,
            ),
        );
        expect(selected).toBe(await link.inputValue());
    },
);

for (const path of ["/join/ABC123", "/join/abc123/", "/join?code=ABC123"]) {
    test(`invite prefills the join form at ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
            "ABC123",
        );
        await expect(page.getByLabel("Your name")).toBeFocused();
        await expect(page.locator("main")).toHaveClass("join-main");
        await page.reload();
        await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
            "ABC123",
        );
    });
}

test("malformed invite lets the player correct the room code", async ({
    page,
}) => {
    await page.goto("/join/TOO-LONG");
    await expect(page.getByRole("alert")).toContainText("invalid room code");
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue("");
    await page.getByLabel("Room code", { exact: true }).fill("abc123");
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "ABC123",
    );
});

test("unavailable room keeps the player on the invite form", async ({
    page,
}) => {
    await page.route("**/api/rooms/ABC123/join", (route) =>
        route.fulfill({ status: 404, json: { error: "Room not found" } }),
    );
    await page.goto("/join/ABC123");
    await page.getByLabel("Your name").fill("Invite Guest");
    await page.getByRole("button", { name: "Join the room" }).click();
    await expect(page.getByRole("alert")).toHaveText("Room not found");
    await expect(page).toHaveURL(/\/join\/ABC123$/);
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "ABC123",
    );
    await expect(
        page.getByRole("button", { name: "Join the room" }),
    ).toBeEnabled();
});

test("back and forward restore the invite code", async ({ page }) => {
    await page.goto("/join/ABC123");
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "ABC123",
    );
    await page.getByRole("button", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByLabel("Room code", { exact: true }).fill("XYZ789");
    await page
        .getByRole("button", { name: "Join a room", exact: true })
        .click();
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "XYZ789",
    );
    await page.goBack();
    await page.goBack();
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "ABC123",
    );
    await page.goForward();
    await page.goForward();
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "XYZ789",
    );
});
