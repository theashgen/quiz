import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("teacher signup, persistent account, hosting, and sign out", async ({
    page,
    baseURL,
    context,
}) => {
    const email = `teacher-${randomUUID()}@example.test`;
    await page.goto("/create");
    await expect(
        page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Create an account", exact: true })
        .click();
    await page.getByLabel("Your name").fill("Professor Ash");
    await page.getByLabel("Email address").fill(email);
    await page
        .getByLabel("Password", { exact: true })
        .fill("A safe classroom passphrase 2026");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
        "type",
        "text",
    );
    await page.getByRole("button", { name: "Hide password" }).click();
    await page.getByRole("button", { name: "Create teacher account" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/create");
    await expect(page.getByLabel("Your name")).toHaveValue("Professor Ash");
    await page.reload();
    await expect(
        page.getByRole("group", { name: "Question source" }),
    ).toBeVisible();
    const cookie = (await context.cookies()).find((entry) =>
        /quiz_account/.test(entry.name),
    );
    expect(cookie).toMatchObject({
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
    });
    expect(cookie?.secure).toBe(new URL(baseURL!).protocol === "https:");
    await page.getByRole("button", { name: "Create my room" }).click();
    await expect(
        page.getByRole("heading", { name: "Your people" }),
    ).toBeVisible();
    await page.goto("/account");
    await expect(
        page.getByRole("heading", { name: "Hey, Professor Ash." }),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Sign out of your account" })
        .click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/account");
    await expect(
        page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("wrong password");
    await page
        .getByRole("button", { name: "Sign in", exact: false })
        .last()
        .click();
    await expect(page.getByRole("alert")).toHaveText(
        "Email or password is incorrect",
    );
    await page
        .getByLabel("Password", { exact: true })
        .fill("A safe classroom passphrase 2026");
    await page
        .getByRole("button", { name: "Sign in", exact: false })
        .last()
        .click();
    await expect(
        page.getByRole("heading", { name: "Hey, Professor Ash." }),
    ).toBeVisible();
});

test("students cannot host and guests can still join", async ({
    page,
    browser,
    baseURL,
}) => {
    await page.goto("/signup");
    await page.getByRole("radio", { name: /Student/ }).check();
    await page.getByLabel("Your name").fill("Curious Student");
    await page
        .getByLabel("Email address")
        .fill(`student-${randomUUID()}@example.test`);
    await page
        .getByLabel("Password", { exact: true })
        .fill("A curious student passphrase");
    await page.getByRole("button", { name: "Create student account" }).click();
    await expect(
        page.getByText("Student account", { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Create a quiz" }),
    ).toHaveCount(0);
    await page.goto("/create");
    await expect(page.getByRole("status")).toContainText(
        "Only teachers can create quizzes",
    );
    const denied = await page.request.post("/api/rooms", {
        headers: { Origin: new URL(baseURL!).origin },
        data: {},
    });
    expect(denied.status()).toBe(403);
    await page
        .getByRole("button", { name: "Join a room", exact: false })
        .click();
    await expect(page.getByLabel("Your name")).toHaveValue("Curious Student");
    const guestContext = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
    });
    try {
        const guest = await guestContext.newPage();
        await guest.goto("/join?code=ABC123");
        await expect(
            guest.getByRole("button", { name: "Join the room" }),
        ).toBeVisible();
        await expect(guest.getByLabel("Your name")).toHaveValue("");
    } finally {
        await guestContext.close();
    }
});

test("auth forms fit mobile and desktop and support keyboard role selection", async ({
    page,
}) => {
    await page.goto("/signup");
    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 320, height: 568 },
    ]) {
        await page.setViewportSize(viewport);
        await expect(
            page.getByRole("radio", { name: /Teacher/ }),
        ).toBeVisible();
        await expect(
            page.getByRole("radio", { name: /Student/ }),
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        await page.getByRole("radio", { name: /Teacher/ }).focus();
        await page.keyboard.press("ArrowRight");
        await expect(
            page.getByRole("radio", { name: /Student/ }),
        ).toBeChecked();
        await page.getByRole("radio", { name: /Teacher/ }).check();
        await page
            .getByRole("button", { name: "Create teacher account" })
            .scrollIntoViewIfNeeded();
        await expect(
            page.getByRole("button", { name: "Create teacher account" }),
        ).toBeInViewport({ ratio: 1 });
    }
});

test("account details have aligned rows with thin horizontal dividers", async ({
    page,
    baseURL,
}) => {
    const response = await page.request.post("/api/auth/signup", {
        headers: { Origin: new URL(baseURL!).origin },
        data: {
            name: "Curious Student",
            email: `student-${randomUUID()}@example.test`,
            password: "A curious student passphrase",
            role: "student",
        },
    });
    expect(response.status()).toBe(201);
    await page.goto("/create");
    await expect(page.getByRole("status")).toContainText(
        "Only teachers can create quizzes",
    );

    const details = page.locator(".account-details");
    const rows = details.locator(":scope > div");
    await expect(rows).toHaveCount(3);
    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(details).toHaveCSS("border-top-width", "1px");
        await expect(details).toHaveCSS(
            "border-top-color",
            "rgb(217, 213, 204)",
        );
        for (const side of ["left", "right", "bottom"]) {
            await expect(details).toHaveCSS(`border-${side}-width`, "0px");
        }
        const bounds = await details.boundingBox();
        let valueColumn: number | undefined;
        for (const row of await rows.all()) {
            await expect(row).toHaveCSS("border-bottom-width", "1px");
            await expect(row).toHaveCSS(
                "border-bottom-color",
                "rgb(217, 213, 204)",
            );
            for (const side of ["left", "right", "top"]) {
                await expect(row).toHaveCSS(`border-${side}-width`, "0px");
            }
            const rowBounds = await row.boundingBox();
            const label = await row.locator("dt").boundingBox();
            const value = await row.locator("dd").boundingBox();
            expect(rowBounds!.x).toBeCloseTo(bounds!.x, 0);
            expect(rowBounds!.width).toBeCloseTo(bounds!.width, 0);
            expect(label!.x).toBeCloseTo(bounds!.x, 0);
            valueColumn ??= value!.x;
            expect(value!.x).toBeCloseTo(valueColumn, 0);
        }
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
    }
});
