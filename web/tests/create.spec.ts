import { test, expect } from "./teacher-fixture";

test("custom studio uses a flat writing surface instead of nested cards", async ({
    page,
}) => {
    await page.goto("/create");
    await page.getByRole("button", { name: "Your own questions" }).click();
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const selector of [
            ".custom-editor",
            ".editor-question",
            ".setup-aside",
            ".saved-quizzes",
        ]) {
            await expect(page.locator(selector).first()).toHaveCSS(
                "border-radius",
                "0px",
            );
            await expect(page.locator(selector).first()).toHaveCSS(
                "box-shadow",
                "none",
            );
        }
        await expect(page.locator(".editor-question")).toHaveCSS(
            "border-top-width",
            "0px",
        );
        await expect(page.locator(".editor-question")).toHaveCSS(
            "border-left-width",
            "0px",
        );
        await expect(page.getByLabel("Quiz title")).toHaveCSS(
            "border-top-width",
            "1px",
        );
        await expect(
            page.getByRole("button", { name: "Your own questions" }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
            page.getByRole("button", { name: "Save a copy" }),
        ).toHaveCSS("border-radius", "100px");
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
    }
});

test("custom editor tracks readiness and duplicates independent questions", async ({
    page,
}) => {
    await page.goto("/create");
    await page.getByRole("button", { name: "Your own questions" }).click();
    await expect(page.getByText("0 of 1 ready")).toBeVisible();
    await page
        .getByLabel("Question text")
        .fill("Which planet is closest to the Sun?");
    for (const [index, answer] of [
        "Mercury",
        "Venus",
        "Earth",
        "Mars",
    ].entries()) {
        await page
            .getByLabel(`Question 1, option ${"ABCD"[index]}`, { exact: true })
            .fill(answer);
    }
    await expect(page.getByText("1 of 1 ready")).toBeVisible();
    await page
        .getByLabel("Question 1, option D", { exact: true })
        .fill(" mercury ");
    await expect(
        page.getByText("Each answer needs to be different."),
    ).toBeVisible();
    await expect(page.getByText("0 of 1 ready")).toBeVisible();
    await page.getByLabel("Question 1, option D", { exact: true }).fill("Mars");
    await page
        .getByRole("radio", { name: "Question 1: option B is correct" })
        .check();
    await expect(
        page.getByText("Answer B is marked correct.", { exact: false }),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Duplicate question 1", exact: true })
        .click();
    await expect(page.getByLabel("Question text").last()).toBeFocused();
    await expect(page.getByText("2 of 2 ready")).toBeVisible();
    await expect(
        page.getByRole("radio", { name: "Question 2: option B is correct" }),
    ).toBeChecked();
    await page.getByLabel("Question text").last().fill("A different question");
    await expect(page.getByLabel("Question text").first()).toHaveValue(
        "Which planet is closest to the Sun?",
    );
    await page.getByRole("button", { name: "Move question 2 up" }).click();
    await expect(page.getByLabel("Question text").first()).toHaveValue(
        "A different question",
    );
    await page
        .getByRole("button", { name: "Delete question 1", exact: true })
        .click();
    await expect(page.getByLabel("Question text")).toHaveCount(1);
    await expect(
        page.getByRole("button", { name: "Delete question 1", exact: true }),
    ).toBeDisabled();
});

test("custom drafts remain available in the browser library", async ({
    page,
}) => {
    await page.goto("/create");
    await page.getByRole("button", { name: "Your own questions" }).click();
    await expect(page.locator(".saved-quizzes")).not.toHaveAttribute(
        "open",
        "",
    );
    await page.getByLabel("Quiz title").fill("Friday inside jokes");
    await page.getByLabel("Question text").fill("Who always arrives late?");
    await page.getByRole("button", { name: "Save a copy" }).click();
    await expect(
        page.getByText("Friday inside jokes", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Your own questions" }).click();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.getByLabel("Question text")).toHaveValue(
        "Who always arrives late?",
    );
    await expect(page.getByLabel("Quiz title")).toHaveValue(
        "Friday inside jokes",
    );
});

test("create setup fits laptop screens without clipping controls", async ({
    page,
}) => {
    await page.goto("/create");
    const submit = page.getByRole("button", { name: "Create my room" });
    await expect(submit).toBeVisible();
    for (const viewport of [
        { width: 1498, height: 974 },
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 1280, height: 720 },
        { width: 1024, height: 768 },
        { width: 1000, height: 700 },
    ]) {
        await page.setViewportSize(viewport);
        expect(
            await page.evaluate(() => ({
                width: document.documentElement.scrollWidth,
                height: document.documentElement.scrollHeight,
            })),
            JSON.stringify(viewport),
        ).toEqual(viewport);
        for (const selector of [
            ".category",
            ".avatars button",
            ".segmented button",
        ]) {
            for (const control of await page.locator(selector).all()) {
                await expect(control).toBeInViewport({ ratio: 1 });
            }
        }
        await expect(submit).toBeInViewport({ ratio: 1 });
        await expect(page.getByLabel("Your name")).toBeInViewport({ ratio: 1 });
        await expect(
            page.getByRole("checkbox", { name: /I’m playing too/ }),
        ).toBeInViewport({
            ratio: 1,
        });
    }
});

test("long custom quizzes scroll in their editor with room actions in view", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/create");
    await page.getByRole("button", { name: "Your own questions" }).click();
    const editor = page.locator(".custom-editor");
    for (let question = 0; question < 3; question++) {
        await page.getByRole("button", { name: "Add a question" }).click();
    }
    await expect(page.getByLabel("Question text")).toHaveCount(4);
    await page.getByLabel("Question text").last().fill("Still reachable?");
    await expect(page.getByLabel("Question text").last()).toBeInViewport({
        ratio: 1,
    });
    expect(
        await editor.evaluate(
            (element) => element.scrollHeight > element.clientHeight,
        ),
    ).toBeTruthy();
    await expect(
        page.getByRole("button", { name: "Create my room" }),
    ).toBeInViewport({
        ratio: 1,
    });
    const layout = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        viewport: innerHeight,
        boxes: [
            ...document.querySelectorAll(".setup-main,.setup-aside,footer"),
        ].map((element) => ({
            className: element.className,
            bottom: element.getBoundingClientRect().bottom,
            height: element.getBoundingClientRect().height,
        })),
    }));
    expect(layout.height, JSON.stringify(layout)).toBeLessThanOrEqual(
        layout.viewport,
    );
    await editor.evaluate((element) => element.scrollTo(0, 0));
    await expect(page.getByLabel("Quiz title")).toBeInViewport({ ratio: 1 });
});

test("small screens and zoomed layouts can still reach every setup action", async ({
    page,
}) => {
    for (const viewport of [
        { width: 390, height: 844 },
        { width: 320, height: 568 },
        { width: 640, height: 360 },
    ]) {
        await page.setViewportSize(viewport);
        await page.goto("/create");
        await page.getByLabel("Your name").fill("Player");
        const submit = page.getByRole("button", { name: "Create my room" });
        await submit.scrollIntoViewIfNeeded();
        await expect(submit).toBeInViewport({ ratio: 1 });
        await page.getByRole("button", { name: "Your own questions" }).click();
        await page.getByRole("button", { name: "Add a question" }).click();
        await page.getByLabel("Question text").last().fill("A mobile question");
        await submit.scrollIntoViewIfNeeded();
        await expect(submit).toBeInViewport({ ratio: 1 });
        await expect(page.locator(".custom-editor")).toHaveCSS(
            "overflow-y",
            "visible",
        );
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
    }
});
