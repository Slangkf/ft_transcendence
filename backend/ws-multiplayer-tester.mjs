import { io } from "socket.io-client";
import fetch  from "node-fetch";

// ================= CONFIG =================
const SERVER_URL = "http://localhost:3000";

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
};

// ================= UTILS =================
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
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

  async auth() {
    console.log(`🔐 [${this.name}] auth...`);

    let res = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.email,
        password: this.password,
        username: this.name
      })
    });

    // already exists → login
    if (res.status === 409) {
      res = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: this.email,
          password: this.password
        })
      });
    }

    const cookie = res.headers.get("set-cookie");
    const match = cookie?.match(/auth_token=([^;]+)/);

    if (!match) throw new Error("No token");

    this.token = match[1];
    this.state = State.AUTH;

    console.log(`✅ [${this.name}] authenticated`);
  }

  connectWS() {
    console.log(`🔌 [${this.name}] connecting WS...`);

    this.socket = io(SERVER_URL, {
      auth: { token: this.token }
    });

    this.socket.on("connect", () => {
      console.log(`✅ [${this.name}] WS connected`);
      this.state = State.CONNECTED;
    });

    this.socket.on("matched", (data) => {
      console.log(`🎯 [${this.name}] matched`, data);

      this.roomId = data.roomId;
      this.state = State.MATCHED;
    });

    this.socket.on("game_started", (data) => {
      console.log(`🚀 [${this.name}] game started`, data);

      this.gameId = data.gameId;
      this.state = State.STARTED;
    });

    this.socket.on("answer_result", (data) => {
      console.log(`📊 [${this.name}] answer result`, data);
    });

    this.socket.on("player_ready", (data) => {
      console.log(`🟢 [${this.name}] ready update`, data);
    });
  }

  async startMatchmaking() {
    console.log(`🎮 [${this.name}] start matchmaking`);

    await fetch(`${SERVER_URL}/api/game/multiplayer/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({ mode: "multiplayer" })
    });

    this.state = State.MATCHING;
  }

  async ready() {
    if (!this.roomId) throw new Error("No roomId");

    console.log(`🟢 [${this.name}] ready`);

    await fetch(`${SERVER_URL}/api/game/multiplayer/ready/${this.roomId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({ isReady: true })
    });

    this.state = State.READY;
  }

  async answer(index = 0) {
    console.log(`🎯 [${this.name}] answer`);

    this.socket.emit("submit_answer", {
      gameId: this.gameId,
      answerIndex: index
    });
  }

  async waitForState(target) {
    while (this.state !== target) {
      await wait(100);
    }
  }
}

// ================= TEST RUNNER =================
async function run() {
  console.log("\n🚀 AUTO STATE MACHINE TEST\n");

  const u1 = new TestUser("user1", "user1@test.com", "123456yhtg4r");
  const u2 = new TestUser("user2", "user2@test.com", "123456j6hy5t4r3");

  // 1. AUTH
  await u1.auth();
  await u2.auth();

  // 2. WS CONNECT
  u1.connectWS();
  u2.connectWS();

  await wait(1000);

  // 3. START MATCHMAKING
  await u1.startMatchmaking();
  await u2.startMatchmaking();

  // 4. WAIT MATCH
  await u1.waitForState(State.MATCHED);

  console.log("\n✅ MATCH CREATED:", u1.roomId);

  // 5. READY
  await u1.ready();
  await u2.ready();

  // 6. WAIT GAME START
  await u1.waitForState(State.STARTED);

  console.log("\n🚀 GAME STARTED:", u1.gameId);

  // 7. PLAY
  await wait(1000);

  await u1.answer(0);
  await u2.answer(1);

  console.log("\n🎉 TEST FLOW COMPLETED\n");
}

run().catch(console.error);