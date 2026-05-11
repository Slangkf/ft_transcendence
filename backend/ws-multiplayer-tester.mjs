import { io } from "socket.io-client";
import fetch from "node-fetch";
import https from "https";

// ================= HTTPS =================
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ================= CONFIG =================
const SERVER_URL = "https://localhost:8888";

// ================= STATE =================
const State = {
  INIT: "INIT",
  AUTH: "AUTH",
  CONNECTED: "CONNECTED",
  MATCHING: "MATCHING",
  MATCHED: "MATCHED",
  READY: "READY",
  STARTED: "STARTED",
  PLAYING: "PLAYING",
  FINISHED: "FINISHED",
};

// ================= UTILS =================
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ================= USER CLASS =================
class TestUser {
  constructor(name, email, password) {
    this.name = name;
    this.email = email;
    this.password = password;

    this.token = null;
    this.socket = null;

    this.state = State.INIT;

    this.roomId = null;
    this.gameId = null;
  }

  // ================= FETCH WRAPPER =================
  async safeFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      agent: httpsAgent,
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      const text = await res.text();

      console.error(`❌ [${this.name}] HTTP ERROR ${res.status}`);
      console.error(text);

      throw new Error(`HTTP ${res.status}`);
    }

    if (contentType.includes("application/json")) {
      return await res.json();
    }

    return await res.text();
  }

  // ================= AUTH =================
  async auth() {
    console.log(`🔐 [${this.name}] auth...`);

    try {
      let res = await fetch(`${SERVER_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
          username: this.name,
        }),
        agent: httpsAgent,
      });

      // already exists → login
      if (res.status === 409) {
        console.log(`ℹ️ [${this.name}] user already exists → login`);

        res = await fetch(`${SERVER_URL}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: this.email,
            password: this.password,
          }),
          agent: httpsAgent,
        });
      }

      if (!res.ok) {
        const text = await res.text();

        console.error(`❌ [${this.name}] auth failed`);
        console.error(text);

        throw new Error(`Auth failed: ${res.status}`);
      }

      const cookieHeader = res.headers.get("set-cookie");

      if (!cookieHeader) {
        console.error(`❌ [${this.name}] No set-cookie header`);

        const text = await res.text();
        console.error(text);

        throw new Error("No token");
      }

      const match = cookieHeader.match(/auth_token=([^;]+)/);

      if (!match) {
        throw new Error("No auth_token in cookie");
      }

      this.token = match[1];
      this.state = State.AUTH;

      console.log(`✅ [${this.name}] authenticated`);

      // cleanup queue
      await this.cleanupQueue();

    } catch (err) {
      console.error(`❌ [${this.name}] auth exception`);
      console.error(err);
      throw err;
    }
  }

  // ================= CLEANUP =================
  async cleanupQueue() {
    try {
      await this.safeFetch(`${SERVER_URL}/api/game/leave-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      console.log(`🧹 [${this.name}] queue cleaned`);
    } catch (e) {
      console.log(`⚠️ [${this.name}] cleanup skipped`);
    }
  }

  // ================= SOCKET =================
  connectWS() {
    console.log(`🔌 [${this.name}] connecting websocket...`);

    this.socket = io(`${SERVER_URL}/game`, {
      transports: ["websocket", "polling"],

      rejectUnauthorized: false,

      auth: (cb) => {
        cb({
          token: this.token,
        });
      },
    });

    this.socket.on("connect", () => {
      console.log(`✅ [${this.name}] websocket connected`);
      console.log(`🆔 socket id: ${this.socket.id}`);

      this.state = State.CONNECTED;
    });

    this.socket.on("connect_error", (err) => {
      console.error(`❌ [${this.name}] websocket connect_error`);
      console.error(err.message);

      if (err.data) {
        console.error(err.data);
      }
    });

    this.socket.onAny((event, ...args) => {
      console.log(
        `📨 [${this.name}] EVENT: ${event}`,
        JSON.stringify(args, null, 2)
      );
    });

    // ================= GAME EVENTS =================

    this.socket.on("matched", (data) => {
      console.log(`🎯 [${this.name}] matched`);

      this.roomId = data.roomId;
      this.state = State.MATCHED;
    });

    this.socket.on("player_ready", (data) => {
      console.log(`🟢 [${this.name}] player_ready`);
      console.log(data);
    });

    this.socket.on("game_started", (data) => {
      console.log(`🚀 [${this.name}] game_started`);

      this.gameId = data.gameId;
      this.state = State.STARTED;
    });

    this.socket.on("answer_submitted", (data) => {
      console.log(`✅ [${this.name}] answer_submitted`);
      console.log(data);
    });

    this.socket.on("answer_result", (data) => {
      console.log(`📊 [${this.name}] answer_result`);
      console.log(data);
    });

    this.socket.on("game_finished", (data) => {
      console.log(`🏁 [${this.name}] game_finished`);
      console.log(data);

      this.state = State.FINISHED;
    });
  }

  // ================= MATCHMAKING =================
  async startMatchmaking() {
  console.log(`🎮 [${this.name}] start matchmaking`);

  const data = await this.safeFetch(
    `${SERVER_URL}/api/game/multiplayer/start`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        mode: "multiplayer",
      }),
    }
  );

  console.log(`📥 [${this.name}] matchmaking response`);
  console.log(data);

  // backend wrapper
  const payload = data.data;

  if (payload?.status === "matched") {
    this.roomId = payload.roomId;
    this.state = State.MATCHED;

    console.log(`🎯 [${this.name}] already matched from HTTP response`);
  }
  else if (this.state !== State.MATCHED) {
    this.state = State.MATCHING;
  }
}
  // ================= READY =================
  async ready() {
    if (!this.roomId) {
      throw new Error(`[${this.name}] No roomId`);
    }

    console.log(`🟢 [${this.name}] ready`);

    const data = await this.safeFetch(
      `${SERVER_URL}/api/game/multiplayer/ready/${this.roomId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          isReady: true,
        }),
      }
    );

    console.log(`📥 [${this.name}] ready response`);
    console.log(data);

    if (data.gameId) {
      this.gameId = data.gameId;
    }

    this.state = State.READY;
  }

  // ================= ANSWER =================
  async answer(index = 0) {
    if (!this.gameId) {
      console.log(`⚠️ [${this.name}] no gameId`);
      return;
    }

    console.log(`🎯 [${this.name}] submit answer: ${index}`);

    this.socket.emit("submit_answer", {
      gameId: this.gameId,
      answerIndex: index,
    });
  }

  // ================= WAIT STATE =================
  async waitForState(target, timeout = 10000) {
    const start = Date.now();

    while (this.state !== target) {
      if (Date.now() - start > timeout) {
        throw new Error(
          `[${this.name}] timeout waiting for state: ${target}`
        );
      }

      await wait(50);
    }
  }
}

// ================= TEST RUNNER =================
async function run() {
  console.log("\n🚀 AUTO STATE MACHINE TEST\n");

  const timestamp = Date.now();

  const u1 = new TestUser(
    `user1_${timestamp}`,
    `user1_${timestamp}@test.com`,
    "123456Aa!"
  );

  const u2 = new TestUser(
    `user2_${timestamp}`,
    `user2_${timestamp}@test.com`,
    "123456Bb!"
  );

  // ================= AUTH =================
  await u1.auth();
  await u2.auth();

  // ================= WS =================
  u1.connectWS();
  u2.connectWS();

  await u1.waitForState(State.CONNECTED);
  await u2.waitForState(State.CONNECTED);

  // ================= MATCH =================
  await u1.startMatchmaking();
  await u2.startMatchmaking();

  await u1.waitForState(State.MATCHED);
  await u2.waitForState(State.MATCHED);

  console.log("\n✅ MATCH CREATED");
  console.log("ROOM:", u1.roomId);

  // ================= READY =================
  await u1.ready();
  await u2.ready();

  // ================= GAME START =================
  await u1.waitForState(State.STARTED);
  await u2.waitForState(State.STARTED);

  console.log("\n🚀 GAME STARTED");
  console.log("GAME:", u1.gameId);

  // ================= PLAY =================
  let round = 0;

  while (
    round < 10 &&
    u1.state !== State.FINISHED &&
    u2.state !== State.FINISHED
  ) {
    await wait(1000);

    console.log(`\n📝 ROUND ${round + 1}`);

    await u1.answer(Math.floor(Math.random() * 4));
    await u2.answer(Math.floor(Math.random() * 4));

    round++;
  }

  console.log("\n🎉 TEST COMPLETED");

  process.exit(0);
}

run().catch((err) => {
  console.error("\n💥 TEST FAILED");
  console.error(err);

  process.exit(1);
});