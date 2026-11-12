import { expect, test } from "./teacher-fixture";

test.describe("touch-device refresh gestures", () => {
    test.use({ isMobile: true, hasTouch: true });

    for (const width of [390, 820]) {
        test(`page workspaces allow vertical scroll chaining at ${width}px`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 844 });
            for (const path of [
                "/",
                "/join",
                "/create",
                "/create?source=custom",
                "/solo",
                "/account",
            ]) {
                await page.goto(path);
                await expect(
                    page.locator("main h1, main h2").first(),
                ).toBeVisible();
                for (const selector of ["html", "body"]) {
                    await expect(page.locator(selector)).toHaveCSS(
                        "overflow-y",
                        "auto",
                    );
                    await expect(page.locator(selector)).toHaveCSS(
                        "overscroll-behavior-y",
                        "auto",
                    );
                }
                for (const selector of ["#root", "#root > main"]) {
                    await expect(page.locator(selector)).toHaveCSS(
                        "overflow-y",
                        "clip",
                    );
                }
                const blockers = await page
                    .locator("#root, #root *")
                    .evaluateAll((elements) =>
                        elements
                            .filter(
                                (element) =>
                                    getComputedStyle(element)
                                        .overscrollBehaviorY !== "auto",
                            )
                            .map((element) => element.className),
                    );
                expect(blockers, path).toEqual([]);
                expect(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                    ),
                ).toBeTruthy();
            }
            await page.goto("/join");
            await page.getByRole("button", { name: "Browse all" }).click();
            await expect(page.getByRole("dialog")).toHaveCSS(
                "overscroll-behavior-y",
                "contain",
            );
            await page
                .getByRole("button", { name: "Close avatar picker" })
                .click();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(page.locator("html")).toHaveCSS("overflow-y", "auto");
            await expect(page.locator("body")).toHaveCSS("overflow-y", "auto");
        });
    }
});

test("shared screens render shadcn controls rather than raw UI elements", async ({
    page,
}) => {
    for (const path of ["/", "/join", "/create", "/solo"]) {
        await page.goto(path);
        await expect(page.locator("main h1, main h2").first()).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Quiz home" }),
        ).toHaveAttribute("data-slot", "button");
        await expect(page.locator("button:not([data-slot])")).toHaveCount(0);
        await expect(
            page.locator(
                'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([data-slot="input"])',
            ),
        ).toHaveCount(0);
        await expect(
            page.locator('textarea:not([data-slot="textarea"])'),
        ).toHaveCount(0);
    }
    await page.goto("/join");
    await page.getByRole("button", { name: "Browse all" }).click();
    await expect(page.getByRole("dialog")).toHaveAttribute(
        "data-slot",
        "dialog-content",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("single-sided dividers stay thin across join and custom setup screens", async ({
    page,
}) => {
    async function borders(selector: string, widths: number[]) {
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
        ).toEqual(widths);
    }

    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/join");
        await borders(".join-layout", [1, 1, 1, 1]);
        await borders(
            ".join-welcome",
            width > 740 ? [0, 1, 0, 0] : [0, 0, 1, 0],
        );
        if (width > 740) {
            await borders(".join-entry-note", [1, 0, 0, 0]);
        } else {
            await expect(page.locator(".join-entry-note")).toBeHidden();
        }

        await page.goto("/create");
        await page.getByRole("button", { name: "Your own questions" }).click();
        await borders(".custom-editor", [0, 0, 0, 0]);
        await borders(".editor-question", [0, 0, 1, 0]);
        await borders(".saved-quizzes", [0, 0, 1, 0]);
        await borders(
            ".setup-aside",
            width > 740 ? [0, 0, 0, 0] : [1, 0, 0, 0],
        );
    }
});

test("shared dotted cream canvas stays consistent across pages and screen sizes", async ({
    page,
}) => {
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ["/", "/join", "/create", "/solo"]) {
            await page.goto(path);
            await expect(
                page.locator("main h1, main h2").first(),
            ).toBeVisible();
            await expect(page.locator("html")).toHaveCSS(
                "background-color",
                "rgb(250, 247, 240)",
            );
            await expect(page.locator("html")).toHaveCSS(
                "background-image",
                /radial-gradient/,
            );
            await expect(page.locator("html")).toHaveCSS(
                "background-size",
                "24px 24px",
            );
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBeTruthy();
            if (path === "/join") {
                await expect(page.locator(".join-welcome")).toHaveCSS(
                    "background-image",
                    "none",
                );
                await expect(page.locator(".join-layout")).toHaveCSS(
                    "background-image",
                    "none",
                );
            }
        }
    }
});

test("micro interactions respond to input and respect reduced motion", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/join");
    const avatar = page.locator(".avatar-carousel-face img");
    await expect(avatar).toHaveCSS("animation-name", "avatar-switch");
    await page.getByRole("button", { name: "Next avatar" }).click();
    await expect(avatar).toHaveCSS("animation-name", "avatar-switch");
    const name = page.getByLabel("Your name");
    await name.focus();
    await expect(name).toHaveCSS("box-shadow", /rgba?\(/);
    const join = page.getByRole("button", { name: "Join the room" });
    await join.hover();
    await page.mouse.down();
    await expect(join).toHaveCSS("scale", "0.97");
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(avatar).toHaveCSS("animation-name", "none");
    await expect(join).toHaveCSS("transition-duration", "0s");
});
