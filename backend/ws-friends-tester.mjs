// ws-full-integration-tester.mjs
import { io } from "socket.io-client";
import fetch from "node-fetch";
import https from "https";

const SERVER_URL = "https://localhost:8888";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ================= USER =================
class TestUser {
  constructor(name, email, password) {
    this.name = name;
    this.email = email;
    this.password = password;

    this.token = null;

    // sockets
    this.gameSocket = null;
    this.friendSocket = null;

    this.state = "INIT";

    this.roomId = null;
    this.gameId = null;
    this.userId = null; // optional if backend returns it
  }

  // ================= FETCH =================
  async fetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
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
    if (!cookie) throw new Error("No cookie");

    const match = cookie.match(/auth_token=([^;]+)/);
    if (!match) throw new Error("No token");

    this.token = match[1];

    console.log(`✅ [${this.name}] authenticated`);
  }

  // ================= GAME SOCKET =================
  connectGame() {
    this.gameSocket = io(`${SERVER_URL}/game`, {
      transports: ["websocket"],
      rejectUnauthorized: false,
      auth: { token: this.token },
    });

    this.gameSocket.on("connect", () => {
      console.log(`🎮 [${this.name}] GAME connected`);
    });

    this.gameSocket.onAny((event, data) => {
      console.log(`🎮 [${this.name}] EVENT ${event}`, data);
    });

    this.gameSocket.on("matched", (d) => {
      this.roomId = d.roomId;
    });

    this.gameSocket.on("game_started", (d) => {
        console.log("game started res: ", d);
      this.gameId = d.gameId;
    });

    this.gameSocket.on("answer_result", (d) => {
        console.log("in answer: ", this.gameId);
      console.log(`📊 [${this.name}] answer_result`, d);
    });

    this.gameSocket.on("game_finished", (d) => {
      console.log(`🏁 [${this.name}] finished`);
    });

    this.gameSocket.on("connect_error", (e) => {
      console.log(`❌ [${this.name}] game error`, e.message);
    });
  }

  // ================= FRIEND SOCKET =================
  connectFriend() {
    this.friendSocket = io(`${SERVER_URL}/friendship`, {
      transports: ["websocket"],
      rejectUnauthorized: false,
      auth: { token: this.token },
    });

    this.friendSocket.on("connect", () => {
      console.log(`👥 [${this.name}] FRIEND connected`);
    });

    this.friendSocket.onAny((event, data) => {
      console.log(`👥 [${this.name}] EVENT ${event}`, data);
    });

    this.friendSocket.on("friend_request", (d) => {
      console.log(`📩 [${this.name}] friend_request`, d);
    });

    this.friendSocket.on("friend_accept", (d) => {
      console.log(`✅ [${this.name}] friend_accept`, d);
    });

    this.friendSocket.on("friend_online", (d) => {
      console.log(`🟢 [${this.name}] friend_online`, d);
    });

    this.friendSocket.on("friend_offline", (d) => {
      console.log(`🔴 [${this.name}] friend_offline`, d);
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
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ mode: "multiplayer" }),
      }
    );

    console.log(`🎯 [${this.name}] match`, data);

    if (data?.data?.status === "matched") {
      this.roomId = data.data.roomId;
    }
  }

  // ================= READY =================
  async ready() {
    const data = await this.fetch(
      `${SERVER_URL}/api/game/multiplayer/ready/${this.roomId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ isReady: true }),
      }
    );

    console.log(`🟢 [${this.name}] ready`, data);

    if (data.gameId) this.gameId = data.gameId;
  }

  // ================= ANSWER =================
  answer(i) {
    this.gameSocket.emit("submit_answer", {
      gameId: this.gameId,
      answerIndex: i,
    });
  }
}

// ================= RUN =================
async function run() {
  console.log("\n🚀 FULL INTEGRATION TEST\n");

  const ts = Date.now();

  const A = new TestUser(
    `userA_${ts}`,
    `a_${ts}@test.com`,
    "123456Aa!"
  );

  const B = new TestUser(
    `userB_${ts}`,
    `b_${ts}@test.com`,
    "123456Bb!"
  );

  // auth
  await A.auth();
  await B.auth();

  // sockets (IMPORTANT: friend + game both)
  A.connectGame();
  B.connectGame();

  A.connectFriend();
  B.connectFriend();

  await wait(1000);

  // match
  //await A.startMatch();
  //await B.startMatch();
//
  //await wait(2000);
//
  //console.log("\n✅ MATCH READY");
//
  //// ready
  //await A.ready();
  //await B.ready();
//
  //await wait(2000);
//
  //console.log("\n🚀 GAME STARTED");
//
  //// play
  //for (let i = 0; i < 5; i++) {
  //  await wait(1000);
//
  //  A.answer(Math.floor(Math.random() * 4));
  //  B.answer(Math.floor(Math.random() * 4));
  //}
//
  //await wait(3000);
//
  //console.log("\n🏁 TEST DONE");
//
  //process.exit(0);
}

run().catch((e) => {
  console.error("💥 FAILED", e);
  process.exit(1);
});