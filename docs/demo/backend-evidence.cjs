// Produce a read-only database report and a clearly labelled evidence image.
// Requires psql on PATH, or PSQL=/absolute/path/to/psql.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { chromium } = require("../../web/node_modules/playwright");
const snap = require("./screenshot.cjs");
const { code } = JSON.parse(fs.readFileSync("docs/evidence/room.json"));
if (!/^[A-Z0-9]{6}$/.test(code)) throw Error("Invalid room code");
const database =
  process.env.DATABASE_URL ||
  "postgres://quiz:local-quiz-only@localhost:55432/quiz?sslmode=disable";
const psql = process.env.PSQL || "psql";
const result = execFileSync(
  psql,
  [database, "-v", `room=${code}`, "-f", "docs/demo/verify.sql"],
  { encoding: "utf8" },
);
const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  encoding: "utf8",
}).trim();
fs.writeFileSync(
  "docs/evidence/database.txt",
  `Captured: ${new Date().toISOString()}\nApplication revision: ${revision}\nSource: PostgreSQL, read-only query in docs/demo/verify.sql\n\n${result}`,
);
const rows = JSON.parse(
  execFileSync(
    psql,
    [
      database,
      "-Atc",
      `SELECT json_agg(x) FROM (SELECT r.state->'members'->a.session_id->>'name' AS name, count(*)::int AS answers, sum(points)::int AS score, count(*) FILTER(WHERE choice IS NULL)::int AS timeouts FROM accepted_answers a JOIN rooms r ON r.id=a.room_id WHERE r.code='${code}' GROUP BY name ORDER BY score DESC,name) x`,
    ],
    { encoding: "utf8" },
  ),
);
const clients = JSON.parse(fs.readFileSync("docs/evidence/demo-clients.json"));
if (
  clients.room !== code ||
  clients.automatedPlayers !== 11 ||
  rows.length !== 12 ||
  rows.reduce((s, r) => s + r.answers, 0) !== 36 ||
  rows.reduce((s, r) => s + r.timeouts, 0) !== 1
)
  throw Error("Unexpected database totals");
for (const client of clients.clients) {
  const row = rows.find((r) => r.name === client.name);
  if (!row || row.score !== client.score || client.answersAcknowledged !== 3)
    throw Error(`Receipt/ledger mismatch for ${client.name}`);
  if (client.leaderboard.length !== rows.length)
    throw Error(`Incomplete leaderboard for ${client.name}`);
  for (const entry of client.leaderboard) {
    if (rows.find((row) => row.name === entry.name)?.score !== entry.score)
      throw Error(`Leaderboard/ledger mismatch for ${entry.name}`);
  }
}
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const total = rows.reduce((s, r) => s + r.score, 0);
const html = `<!doctype html><html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#f8f6ee;color:#232322;font:16px -apple-system,BlinkMacSystemFont,sans-serif;padding:48px}h1{font-size:36px;margin:10px 0}p{color:#666;line-height:1.6}.tag{font-size:12px;letter-spacing:2px;font-weight:700}.stats{display:flex;gap:16px;margin:30px 0}.stat{background:#fffdf7;border:1px solid #d8d4c9;border-radius:14px;padding:20px;flex:1}.stat b{display:block;font-size:36px}.stat span{font-size:13px;color:#666}table{width:100%;border-collapse:collapse;background:#fffdf7;border-radius:14px;overflow:hidden}th,td{text-align:left;padding:12px 20px;border-bottom:1px solid #e8e4d9}th{background:#e9def9;font-size:13px}.foot{margin-top:24px;font-size:13px}.ok{color:#32673c;font-weight:700}</style><div class="tag">QUIZ / BACKEND EVIDENCE</div><h1>From live play to durable records.</h1><p>Room ${escape(code)} · read-only PostgreSQL queries · application ${escape(revision)}<br>This is a generated verification report, not an application screen.</p><div class="stats"><div class="stat"><b>12</b><span>distinct player sessions</span></div><div class="stat"><b>36</b><span>committed answer records</span></div><div class="stat"><b>1</b><span>server-recorded timeout</span></div><div class="stat"><b>${total}</b><span>total points persisted</span></div></div><table><tr><th>Player</th><th>Answer records</th><th>Score / 300</th><th>Timeouts</th></tr>${rows.map((r) => `<tr><td>${escape(r.name)}</td><td>${r.answers}</td><td>${r.score}</td><td>${r.timeouts}</td></tr>`).join("")}</table><p class="ok">✓ All 11 automated guests: 3 acknowledged answers each; scores match the ledger.</p><p class="foot">Source: docs/demo/verify.sql · Raw output: docs/evidence/database.txt<br>Local synthetic demonstration. One browser player + eleven automated clients; teacher hosts separately.</p></html>`;
(async () => {
  const b = await chromium.launch();
  try {
    const page = await b.newPage({
      viewport: { width: 1200, height: 1100 },
      deviceScaleFactor: 2,
    });
    await page.setContent(html);
    await snap(page, "31-backend-evidence");
  } finally {
    await b.close();
  }
  console.log(
    "Verified 12 players, 36 records, 1 timeout; receipt scores match PostgreSQL.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
