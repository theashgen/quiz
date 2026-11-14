import { test, expect } from "./teacher-fixture";

test("number keys select answers and Enter confirms once per question", async ({
    page,
}) => {
    await page.goto("/solo");
    await page.getByRole("button", { name: "Let’s play" }).click();
    const options = page.locator(".answer-option");
    const submit = page.getByRole("button", { name: "Submit answer" });
    await expect(options).toHaveCount(4);
    await expect(submit).toBeDisabled();
    await page.keyboard.press("Enter");
    await expect(
        page.locator('.answer-option[aria-pressed="true"]'),
    ).toHaveCount(0);
    await expect(submit).toBeDisabled();

    // Typing and browser shortcuts must never choose an answer.
    await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "keyboard-test-input";
        document.body.append(input);
        input.focus();
    });
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
    await expect(page.locator("#keyboard-test-input")).toHaveValue("1");
    await expect(submit).toBeDisabled();
    await page
        .locator("#keyboard-test-input")
        .evaluate((input) => input.remove());
    await page.keyboard.press("Control+2");
    await page.keyboard.press("9");
    await page.evaluate(() =>
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "1", repeat: true }),
        ),
    );
    await expect(submit).toBeDisabled();

    for (let number = 1; number <= 5; number++) {
        await expect(
            page.getByText(`Question ${number} of 5`, { exact: true }),
        ).toBeVisible();
        await expect(submit).toBeDisabled();
        for (let choice = 1; choice <= 4; choice++) {
            await page.keyboard.press(String(choice));
            await expect(options.nth(choice - 1)).toHaveAttribute(
                "aria-pressed",
                "true",
            );
            await expect(
                page.locator('.answer-option[aria-pressed="true"]'),
            ).toHaveCount(1);
        }
        // Enter confirms the number-key selection even when another answer has focus.
        await options.first().focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(".reveal-footer")).toBeVisible();
        await expect(options.nth(3)).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("1");
        await page.keyboard.press("Enter");
        await expect(options.nth(3)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.locator(".solo-results")).toBeVisible();
});
