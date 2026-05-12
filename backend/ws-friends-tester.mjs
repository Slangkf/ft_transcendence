// ws-full-integration-tester.mjs
import { io } from "socket.io-client";
import fetch from "node-fetch";
import https from "https";

const SERVER_URL = "https://localhost:8888";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ================= EVENT HELPER =================
function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

// ================= USER =================
class TestUser {
  constructor(name, email, password) {
    this.name = name;
    this.email = email;
    this.password = password;

    this.token = null;

    this.gameSocket = null;
    this.friendSocket = null;

    this.roomId = null;
    this.gameId = null;
  }

  // ================= FETCH =================
  async fetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers:{
        ...options.headers,
        cookie: `auth_token=${this.token}`
      },
      agent: httpsAgent,
    });

    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      console.error(`❌ [${this.name}] HTTP ${res.status}`, data);
      throw new Error("HTTP ERROR");
    }

    return data;
  }

  // ================= AUTH =================
  async auth() {
    console.log(`🔐 [${this.name}] auth...`);

    let res = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.email,
        password: this.password,
        username: this.name,
      }),
      agent: httpsAgent,
    });

    if (res.status === 409) {
      res = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
        }),
        agent: httpsAgent,
      });
    }

    const cookie = res.headers.get("set-cookie");
    const match = cookie?.match(/auth_token=([^;]+)/);

    if (!match) throw new Error("No auth token");

    this.token = match[1];

    console.log(`✅ [${this.name}] authenticated`);
  }

  // ================= GAME SOCKET =================
  connectGame() {
    this.gameSocket = io(`${SERVER_URL}/game`, {
      transports: ["websocket"],
      rejectUnauthorized: false,
      extraHeaders:{
        cookie: `auth_token=${this.token}`
      }
    });

    this.gameSocket.on("connect", () => {
      console.log(`🎮 [${this.name}] GAME connected`);
    });

    this.gameSocket.onAny((e, d) => {
      console.log(`🎮 [${this.name}] ${e}`, d);
    });

    this.gameSocket.on("matched", (d) => {
      this.roomId = d.roomId;
      console.log(`🎯 [${this.name}] matched room=${this.roomId}`);
    });

    this.gameSocket.on("game_started", (d) => {
      this.gameId = d.gameId;
      this.roomId = d.roomId || this.roomId;

      console.log(`🚀 [${this.name}] game_started gameId=${this.gameId}`);
    });

    this.gameSocket.on("answer_result", (d) => {
      console.log(`📊 [${this.name}] answer_result`, d);
    });

    this.gameSocket.on("game_finished", (d) => {
      console.log(`🏁 [${this.name}] game finished`);
    });
  }

  // ================= FRIEND SOCKET =================
  connectFriend() {
    this.friendSocket = io(`${SERVER_URL}/friendship`, {
      transports: ["websocket"],
      rejectUnauthorized: false,
      extraHeaders:{
        cookie: `auth_token=${this.token}`
      }
    });

    this.friendSocket.on("connect", () => {
      console.log(`👥 [${this.name}] FRIEND connected`);
    });
  }

  // ================= MATCH =================
  async startMatch() {
    const data = await this.fetch(
      `${SERVER_URL}/api/game/multiplayer/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "multiplayer" }),
      }
    );

    console.log(`🎯 [${this.name}] match`, data);
  }

  // ================= READY =================
  async ready() {
    if (!this.roomId) {
      throw new Error(`[${this.name}] roomId not ready`);
    }

    const data = await this.fetch(
      `${SERVER_URL}/api/game/multiplayer/ready/${this.roomId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isReady: true }),
      }
    );

    console.log(`🟢 [${this.name}] ready`, data);
  }

  // ================= ANSWER =================
  answer(i) {
    if (!this.gameId) {
      console.log(`⚠️ [${this.name}] gameId not ready`);
      return;
    }

    this.gameSocket.emit("submit_answer", {
      gameId: this.gameId,
      answerIndex: i,
    });
  }

  // ================= FLOW WAIT HELPERS =================
  waitGameStart() {
    return waitFor(this.gameSocket, "game_started");
  }

  waitMatched() {
    return waitFor(this.gameSocket, "matched");
  }
}

// ================= RUN =================
async function run() {
  console.log("\n🚀 FULL INTEGRATION TEST (FIXED)\n");

  const ts = Date.now();

  const A = new TestUser(`A_${ts}`, `a_${ts}@t.com`, "123456Aa!");
  const B = new TestUser(`B_${ts}`, `b_${ts}@t.com`, "123456Bb!");

  // auth
  await A.auth();
  await B.auth();

  // connect sockets
  A.connectGame();
  B.connectGame();

  A.connectFriend();
  B.connectFriend();

  await wait(1000);

  // start match (HTTP)
  // ✅ 先注册，再发请求
  const waitBothMatched = Promise.all([A.waitMatched(), B.waitMatched()]);

  await A.startMatch();
  await B.startMatch();

  await waitBothMatched; // 这时候不管事件先来还是后来都能捕到
  await wait(500);

  const waitBothStarted =  Promise.all([A.waitGameStart(), B.waitGameStart()]);
  await A.ready();
  await B.ready();

  await waitBothStarted;

  // ready AFTER game started

  console.log("\n Game Started");

  await wait(500);

  console.log("\n🎮 PLAYING");

  // play safely
  for (let i = 0; i < 10; i++) {
    await wait(1200);

    A.answer(Math.floor(Math.random() * 4));
    B.answer(Math.floor(Math.random() * 4));
  }

  await wait(3000);

  console.log("\n🏁 TEST DONE");
  process.exit(0);
}

run().catch((e) => {
  console.error("💥 FAILED", e);
  process.exit(1);
});