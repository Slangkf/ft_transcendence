import { io } from "socket.io-client";
import fetch  from "node-fetch";

// ================= CONFIG =================
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
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
      }),
      credentials: "include"
    });

    // already exists → login
    if (res.status === 409) {
      res = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: this.email,
          password: this.password
        }),
        credentials: "include"
      });
    }

    const cookieHeader = res.headers.get("set-cookie");
    if (!cookieHeader) {
      console.error(`❌ [${this.name}] No set-cookie header. Status: ${res.status}`);
      const body = await res.json();
      console.error(`❌ [${this.name}] Response:`, body);
      throw new Error("No token");
    }

    const match = cookieHeader.match(/auth_token=([^;]+)/);

    if (!match) throw new Error("No token in set-cookie");

    this.token = match[1];
    this.state = State.AUTH;

    console.log(`✅ [${this.name}] authenticated`);
    
    // Clean up any previous matchmaking state
    await this.cleanupQueue();
  }

  async cleanupQueue() {
    try {
      await fetch(`${SERVER_URL}/api/game/leave-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`
        }
      });
      console.log(`🧹 [${this.name}] cleaned up old queue data`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  connectWS() {
    console.log(`🔌 [${this.name}] connecting WS...`);

    this.socket = io(`${SERVER_URL}/game`, {
       auth: (cb) => {
        cb({ token: this.token });
    },
    rejectUnauthorized: false, // 忽略自签名证书
    transports: ['websocket', 'polling'],
    });

    this.socket.on("connect", () => {
      console.log(`✅ [${this.name}] WS connected, id: ${this.socket.id}`);
      this.state = State.CONNECTED;
    });

    this.socket.on('connect_error', (err) => {
        console.log(`❌ [${this.name}] connect_error: ${err.message}`);
        console.log(`❌ [${this.name}] error data:`, err.data); // 服务端传的错误信息
    });

    this.socket.onAny((event, ...args) => {
        console.log(`📨 [${this.name}] event: ${event}`, JSON.stringify(args));
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
      if (data && data.gameresult && data.gameresult.isFinished) {
        this.state = State.PLAYING;
      }
    });

    this.socket.on("answer_submitted", (data) => {
      console.log(`✅ [${this.name}] answer submitted`, data);
    });

    this.socket.on("game_finished", (data) => {
      console.log(`🏁 [${this.name}] game finished`, data);
      this.state = State.PLAYING; // Mark as finished
    });

    this.socket.on("player_ready", (data) => {
      console.log(`🟢 [${this.name}] ready update`, data);
    });
  }

  async startMatchmaking() {
    console.log(`🎮 [${this.name}] start matchmaking`);

    const res = await fetch(`${SERVER_URL}/api/game/multiplayer/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({ mode: "multiplayer" })
    });
    console.log(`[${this.name}] response status:`, res.status);
    const data = await res.json();
    console.log(`[${this.name}] response data:`, data);
    if (data.roomId){
      this.roomId = data.data.roomId;
      this.state = State.MATCHING;
    }
    console.log("state: ", `${this.state}`);
  }

  async ready() {
    if (!this.roomId) throw new Error("No roomId");

    console.log(`🟢 [${this.name}] ready`);

    const res =await fetch(`${SERVER_URL}/api/game/multiplayer/ready/${this.roomId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({ isReady: true })
    });
    const data = await res.json();
    console.log(data);
    if (data.gameId){
      this.gameId = data.gameId;
      this.state = State.READY;}
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
      await wait(50);
    }
  }
}

// ================= TEST RUNNER =================
async function run() {
  console.log("\n🚀 AUTO STATE MACHINE TEST\n");

  const timestamp = Date.now();
  const u1 = new TestUser(`user1_${timestamp}`, `user1_${timestamp}@test.com`, "123456yhtg4r");
  const u2 = new TestUser(`user2_${timestamp}`, `user2_${timestamp}@test.com`, "123456j6hy5t4r3");

  // 1. AUTH
  await u1.auth();
  await u2.auth();

  // 2. WS CONNECT
  u1.connectWS();
  u2.connectWS();

  await u1.waitForState(State.CONNECTED);
  await u2.waitForState(State.CONNECTED);

  // 3. START MATCHMAKING
  await u1.startMatchmaking();
  await u2.startMatchmaking();

  // 4. WAIT MATCH
  await u1.waitForState(State.MATCHED);
  await u2.waitForState(State.MATCHED);

  console.log("\n✅ MATCH CREATED:", u1.roomId);

  // 5. READY
  await u1.ready();
  await u2.ready();

  // 6. WAIT GAME START
  await u1.waitForState(State.STARTED);
  await u2.waitForState(State.STARTED);

  console.log("\n🚀 GAME STARTED:", u1.gameId);

  // 7. PLAY - 持续回答直到游戏结束
  let gameFinished = false;
  let answerCount = 0;
  
  const maxAnswers = 10; // 最多回答10次
  
  while (answerCount < maxAnswers && !gameFinished) {
    await wait(500);
    
    if (u1.gameId && u2.gameId) {
      console.log(`\n📝 [ROUND ${answerCount + 1}] Players submitting answers...`);
      await u1.answer(Math.floor(Math.random() * 4));
      await u2.answer(Math.floor(Math.random() * 4));
      answerCount++;
      
      // 检查是否有任何一个player的state改变了，表示游戏可能结束了
      // 由于是多人游戏，game_finished可能会通过websocket通知
      if (u1.state === State.PLAYING && u2.state === State.PLAYING) {
        console.log("✅ Both players answered");
      }
    }
  }

  console.log("\n🎉 TEST FLOW COMPLETED\n");
}

run().catch(console.error);