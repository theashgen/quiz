// Eleven independent guest clients for a 12-player local walkthrough.
// Run from the repository root: node docs/demo/players.cjs ROOM_CODE
const {
  ws: WebSocket,
} = require("../../web/node_modules/playwright-core/lib/utilsBundle.js");
const { randomUUID } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const origin = process.env.APP_URL || "http://localhost:8443";
const code = process.argv[2];
if (!/^[A-Z0-9]{6}$/.test(code || ""))
  throw Error("Supply a six-character room code");
const names = [
  "Maya",
  "Arjun",
  "Sofia",
  "Noah",
  "Zara",
  "Leo",
  "Claire",
  "Evander",
  "Kenton",
  "Priya",
  "Sam",
];
const clients = [];
async function post(client, path, body) {
  const response = await fetch(`${origin}/api${path}`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: client.cookie || "",
    },
    body: JSON.stringify(body),
  });
  const cookies = new Map(
    (client.cookie || "")
      .split("; ")
      .filter(Boolean)
      .map((x) => [x.split("=")[0], x]),
  );
  for (const cookie of response.headers.getSetCookie())
    cookies.set(cookie.split("=")[0], cookie.split(";")[0]);
  client.cookie = [...cookies.values()].join("; ");
  const result = await response.json();
  if (!response.ok)
    throw Error(`${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
function send(client, type, extra = {}) {
  client.socket.send(
    JSON.stringify({
      type,
      requestId: randomUUID(),
      roundId: client.snapshot.roundId,
      ...extra,
    }),
  );
}
function evidence() {
  writeFileSync(
    "docs/evidence/demo-clients.json",
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        room: code,
        automatedPlayers: clients.length,
        note: "11 automated guests plus one browser-driven guest. Real HTTP sessions and WebSockets; no mocked responses.",
        clients: clients.map((c) => ({
          name: c.name,
          answersAcknowledged: c.acks,
          status: c.snapshot?.status,
          score: c.snapshot?.personal?.score,
          leaderboard: c.snapshot?.leaderboard?.map(
            ({ name, score, rank }) => ({ name, score, rank }),
          ),
        })),
      },
      null,
      2,
    ) + "\n",
  );
}
(async () => {
  for (const [i, name] of names.entries()) {
    const client = { name, acks: 0, seen: new Set() };
    await post(client, "/session", {});
    await post(client, `/rooms/${code}/join`, {
      name,
      avatar: `memoji-${[21, 9, 12, 7, 33, 1, 58, 10, 13, 42, 18][i]}`,
    });
    const wsURL = new URL(
      `/api/rooms/${code}/ws?mode=claim&owner=${randomUUID()}`,
      origin,
    );
    wsURL.protocol = origin.startsWith("https:") ? "wss:" : "ws:";
    client.socket = new WebSocket(wsURL, {
      headers: { Origin: origin, Cookie: client.cookie },
    });
    client.socket.on("message", (raw) => {
      const event = JSON.parse(String(raw));
      if (event.error) console.error(name, event.error);
      if (event.receipt && event.type === "ack") client.acks++;
      if (!event.snapshot) return;
      client.snapshot = event.snapshot;
      const p = client.snapshot.personal;
      const key = client.snapshot.roundId + ":" + p?.question?.id;
      if (p?.phase === "question" && !client.seen.has(key)) {
        client.seen.add(key);
        // The walkthrough's three custom questions all mark option A correct.
        // Deliberately vary answers to produce realistic ranks and ties.
        const choice = (i + p.number) % 4 === 0 ? 1 : 0;
        setTimeout(
          () => send(client, "answer", { questionId: p.question.id, choice }),
          1700 + i * 420,
        );
      }
      if (client.snapshot.status === "results") evidence();
    });
    await new Promise((resolve, reject) => {
      client.socket.once("open", resolve);
      client.socket.once("error", reject);
    });
    clients.push(client);
  }
  console.log(
    `Joined ${clients.length} independent guest sessions to ${code}. Keep running during capture; Ctrl-C stops clients.`,
  );
  evidence();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
process.on("SIGINT", () => {
  for (const c of clients) c.socket.close();
  process.exit(0);
});
