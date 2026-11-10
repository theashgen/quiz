// Rebuild first. Run from repository root: node docs/demo/capture.cjs
// Uses the actual local app, fresh accounts, 11 protocol clients and one UI player.
const { chromium, expect } = require("../../web/node_modules/@playwright/test");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const origin = process.env.APP_URL || "http://localhost:8443";
const output = "docs/media/screenshots";
const questions = [
  [
    "Which database stores the durable quiz results?",
    ["PostgreSQL", "Redis", "Local storage", "A text file"],
  ],
  [
    "Which connection carries live room updates?",
    ["WebSocket", "SMTP", "FTP", "DNS"],
  ],
  ["Which language powers this quiz server?", ["Go", "Ruby", "Java", "PHP"]],
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function snap(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  console.log("Screenshot", name);
}
async function click(page, name) {
  await page.getByRole("button", { name, exact: false }).click();
}
(async () => {
  const browser = await chromium.launch();
  let bots;
  try {
    const options = {
      baseURL: origin,
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 2,
    };
    const hostContext = await browser.newContext({
      ...options,
      recordVideo: {
        dir: ".local/readme-recordings",
        size: { width: 1440, height: 1000 },
      },
    });
    hostContext.setDefaultTimeout(15000);
    let host = await hostContext.newPage();
    await host.goto("/");
    await host.locator(".host-action").waitFor();
    await snap(host, "01-home");
    await wait(1800);
    await click(host, "Create a room");
    await host.getByLabel("Email address").waitFor();
    await snap(host, "22-login");
    await wait(1000);
    await host
      .getByRole("button", { name: "Create an account", exact: true })
      .click();
    await snap(host, "02-signup");
    await host.getByLabel("Your name").fill("Ash");
    await host
      .getByLabel("Email address")
      .fill(`showcase-${randomUUID()}@example.test`);
    await host
      .getByLabel("Password", { exact: true })
      .fill("A classroom showcase passphrase 2026");
    await wait(1000);
    await click(host, "Create teacher account");
    await host.getByRole("group", { name: "Question source" }).waitFor();
    await snap(host, "04-preset-setup");
    await wait(1600);
    await click(host, "Your own questions");
    for (let q = 0; q < questions.length; q++) {
      if (q) await click(host, "Add a question");
      await host.locator("textarea").nth(q).fill(questions[q][0]);
      for (let i = 0; i < 4; i++)
        await host
          .getByLabel(`Question ${q + 1}, option ${"ABCD"[i]}`, { exact: true })
          .fill(questions[q][1][i]);
      await wait(650);
    }
    await host.getByLabel("Quiz title").fill("Full-stack fundamentals");
    await click(host, "Save a copy");
    await host.evaluate(() => scrollTo(0, 0));
    await snap(host, "05-custom-editor");
    await wait(1500);
    await click(host, "Browse all");
    await snap(host, "06-avatar-picker");
    await wait(1000);
    await host.keyboard.press("Escape");
    await click(host, "Create my room");
    await host.locator(".room-code").waitFor();
    const code = (await host.locator(".room-code").innerText()).slice(0, 6);
    fs.writeFileSync(
      "docs/evidence/room.json",
      JSON.stringify({ code, players: 12, questions: 3, origin }, null, 2) +
        "\n",
    );
    bots = spawn(process.execPath, ["docs/demo/players.cjs", code], {
      env: { ...process.env, APP_URL: origin },
      stdio: ["ignore", "pipe", "inherit"],
    });
    await new Promise((resolve, reject) => {
      bots.stdout.once("data", (data) => {
        console.log(String(data));
        resolve();
      });
      bots.once("exit", (n) => {
        if (n) reject(Error("Guest clients failed"));
      });
    });
    await snap(host, "09-host-lobby");
    await wait(1500);
    const hostState = await hostContext.storageState();
    const hostVideo = host.video();
    await hostContext.close();
    await hostVideo.saveAs(".local/readme-host.webm");
    // Reopen host with the same cookie state, without adding a second video segment.
    // The saved account/guest identity below keeps host ownership in a separate context.
    const controlContext = await browser.newContext({
      ...options,
      storageState: hostState,
    });
    host = await controlContext.newPage();
    await host.goto("/room/" + code);
    await host.locator(".room-code").waitFor();
    const playerContext = await browser.newContext({
      ...options,
      recordVideo: {
        dir: ".local/readme-recordings",
        size: { width: 1440, height: 1000 },
      },
    });
    const player = await playerContext.newPage();
    await player.goto("/");
    await player.locator("#home-room-code").waitFor();
    await wait(1600);
    await player.getByLabel("Room code", { exact: true }).fill(code);
    await wait(700);
    await click(player, "Join a room");
    await player.getByLabel("Your name").fill("Ada");
    await click(player, "Next avatar");
    await wait(1000);
    await snap(player, "07-join");
    await click(player, "Join the room");
    await player.locator(".room-code").waitFor();
    await expect(player.getByText("12 playing", { exact: true })).toBeVisible();
    await snap(player, "08-player-lobby");
    await snap(host, "09-host-lobby");
    await wait(2500);
    await click(host, "Start the quiz");
    for (let q = 1; q <= 3; q++) {
      await player.getByText(`Question ${q} of 3`, { exact: true }).waitFor();
      await player.getByRole("button", { name: "Submit answer" }).waitFor();
      if (q === 1) {
        await snap(player, "10-question");
        await snap(host, "18-host-live-progress");
        await player.locator(".answer-option").first().click();
        await snap(player, "11-selected-answer");
        await wait(1500);
        await click(player, "Submit answer");
        await player.locator(".reveal-footer").waitFor();
        await snap(player, "12-answer-reveal");
      } else if (q === 2) {
        await wait(1800);
        await player.locator(".answer-option").nth(1).click();
        await wait(500);
        await click(player, "Submit answer");
        await player.locator(".reveal-footer").waitFor();
        await snap(player, "19-incorrect-reveal");
      } else {
        await wait(8400);
        await snap(player, "20-timer-urgent");
        await player.locator(".reveal-footer").waitFor();
        await snap(player, "21-timeout-reveal");
      }
    }
    await player
      .getByRole("heading", { name: "The final leaderboard" })
      .waitFor();
    await snap(player, "13-leaderboard");
    await snap(host, "14-host-results");
    await wait(2500);
    await player
      .getByRole("button", { name: "Count me in for another" })
      .scrollIntoViewIfNeeded();
    await wait(1200);
    await click(player, "Count me in");
    await snap(player, "15-replay-opt-in");
    await wait(1500);
    await click(host, "Set up the next quiz");
    await snap(player, "16-host-preparing");
    await wait(2000);
    await click(host, "Open next lobby");
    await player.locator(".room-code").waitFor();
    await snap(player, "17-next-lobby");
    await wait(2000);
    const playerVideo = player.video();
    await playerContext.close();
    await playerVideo.saveAs(".local/readme-player.webm");
    console.log("Multiplayer recording complete:", code);
    // Additional product states, captured from real navigation and server responses.
    await host.goto("/account");
    await host.getByRole("heading", { name: "Hey, Ash." }).waitFor();
    await snap(host, "03-account");
    const soloContext = await browser.newContext({
      ...options,
      recordVideo: {
        dir: ".local/readme-recordings",
        size: { width: 1440, height: 1000 },
      },
    });
    const solo = await soloContext.newPage();
    await solo.goto("/solo");
    await solo.getByRole("button", { name: "Let’s play" }).waitFor();
    await snap(solo, "23-solo-setup");
    await wait(1500);
    await click(solo, "Let’s play");
    for (let q = 1; q <= 5; q++) {
      await solo.getByText(`Question ${q} of 5`, { exact: true }).waitFor();
      await solo.getByRole("button", { name: "Submit answer" }).waitFor();
      await wait(1100);
      await solo.locator(".answer-option").first().click();
      await click(solo, "Submit answer");
      await solo.locator(".reveal-footer").waitFor();
    }
    await solo
      .getByRole("heading", { name: "Your result", exact: true })
      .waitFor();
    await snap(solo, "24-solo-results");
    await wait(2200);
    const soloVideo = solo.video();
    await soloContext.close();
    await soloVideo.saveAs(".local/readme-solo.webm");
    const extra = await browser.newContext(options);
    extra.setDefaultTimeout(15000);
    const page = await extra.newPage();
    await page.goto("/join?code=ZZZZZZ");
    await page.getByLabel("Your name").fill("Ada");
    await click(page, "Join the room");
    await page.getByRole("alert").waitFor();
    await snap(page, "25-room-not-found");
    await page.goto("/login");
    await page.getByLabel("Email address").fill("unknown@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("An incorrect passphrase");
    await page.locator("form .auth-submit").click();
    await page.getByRole("alert").waitFor();
    await snap(page, "26-login-error");
    console.log("All captures complete.");
  } finally {
    bots?.kill("SIGINT");
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
