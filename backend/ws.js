import { io } from "socket.io-client";
import fetch from "node-fetch";

// ================= CONFIG =================
const SERVER = "http://localhost:3000";

const USERS = [
    { username: "userA", email: "a@test.com", password: "12345678900" },
    { username: "userB", email: "b@test.com", password: "12345678900" }
];

// 保存 token + cookie
const state = [];

// ================= HTTP HELPERS =================

async function register(user) {
    await fetch(`${SERVER}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
    });
}

async function login(user) {
    const res = await fetch(`${SERVER}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
    });

    const cookie = res.headers.get("set-cookie");
    const data = await res.json();

    return {
        cookie,
        userId: data.userId
    };
}

async function startGame(cookie) {
    const res = await fetch(`${SERVER}/api/game/multiplayer/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookie
        },
        body: JSON.stringify({ mode: "multiplayer" })
    });

    return await res.json();
}

async function setReady(cookie, roomId) {
    await fetch(`${SERVER}/api/game/multiplayer/ready/${roomId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookie
        },
        body: JSON.stringify({ isReady: true })
    });
}

// ================= SOCKET =================

function createSocket(name, token) {
    const socket = io(SERVER, {
        auth: { token }
    });

    socket.on("connect", () => {
        console.log(`✅ ${name} connected`);
    });

    socket.on("matched", (data) => {
        console.log(`🎯 ${name} matched`, data);
        state.roomId = data.roomId;
    });

    socket.on("game_started", (data) => {
        console.log(`🚀 ${name} GAME STARTED`, data);
    });

    socket.on("answer_result", (data) => {
        console.log(`📊 ${name} answer`, data);
    });

    return socket;
}

// ================= MAIN FLOW =================

async function run() {

    console.log("\n=== 1. REGISTER USERS ===");
    for (const u of USERS) {
        await register(u);
    }

    console.log("\n=== 2. LOGIN USERS ===");
    for (const u of USERS) {
        const loginRes = await login(u);
        state.push(loginRes);
    }

    console.log("\n=== 3. CONNECT SOCKETS ===");
    const sockets = state.map((s, i) =>
        createSocket(`User${i + 1}`, s.userId)
    );

    await new Promise(r => setTimeout(r, 1000));

    console.log("\n=== 4. START GAME ===");
    for (const s of state) {
        await startGame(s.cookie);
    }

    // 等待 matchmaking + matched event
    await new Promise(r => setTimeout(r, 3000));

    const roomId = state.roomId;

    console.log("\n=== 5. READY ===", roomId);

    for (const s of state) {
        await setReady(s.cookie, roomId);
    }

    console.log("\n⏳ waiting game flow...\n");
}

run();