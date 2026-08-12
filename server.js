const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");

const publicDir = path.join(__dirname, "public");
const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const server = http.createServer((request, response) => {
  const requested = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) { response.writeHead(403); return response.end("Forbidden"); }
  fs.readFile(filePath, (error, data) => {
    if (error) { response.writeHead(404); return response.end("Not found"); }
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const COLORS = ["#d7ff45", "#67e8f9", "#fda4af", "#c4b5fd", "#fdba74", "#86efac"];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const code = () => Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const send = (ws, message) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(message));
const broadcast = (room, message) => room.players.forEach(p => send(p.ws, message));
const publicPlayers = room => room.players.map(({ id, name, x, y, facing, role, caught, disguised, color }) => ({ id, name, x, y, facing, role, caught, disguised, color }));

function lobby(room) {
  broadcast(room, { type: "lobby", code: room.code, hostId: room.hostId, players: publicPlayers(room) });
}
function createPlayer(ws, name) {
  return { id: crypto.randomUUID(), ws, name: String(name || "카멜레온").trim().slice(0, 12) || "카멜레온", x: 80, y: 80, facing: 0, role: "hider", caught: false, disguised: false, color: COLORS[Math.floor(Math.random() * COLORS.length)], input: {} };
}
function start(room) {
  if (room.players.length < 2) return send(room.players.find(p => p.id === room.hostId)?.ws, { type: "error", message: "2명 이상 필요해요." });
  room.state = "playing"; room.timeLeft = 75; room.startedAt = Date.now();
  const hunterIndex = Math.floor(Math.random() * room.players.length);
  room.players.forEach((p, i) => {
    p.role = i === hunterIndex ? "hunter" : "hider"; p.caught = false; p.disguised = false;
    p.x = i === hunterIndex ? 825 : 90 + (i * 67) % 520; p.y = i === hunterIndex ? 490 : 95 + (i * 113) % 380;
  });
  broadcast(room, { type: "started", timeLeft: room.timeLeft, players: publicPlayers(room) });
}
function finish(room, winner) {
  if (room.state !== "playing") return;
  room.state = "lobby";
  broadcast(room, { type: "ended", winner, players: publicPlayers(room) });
  setTimeout(() => rooms.has(room.code) && lobby(room), 800);
}

wss.on("connection", ws => {
  let player;
  ws.on("message", raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "create") {
      let roomCode; do roomCode = code(); while (rooms.has(roomCode));
      player = createPlayer(ws, msg.name);
      const room = { code: roomCode, hostId: player.id, state: "lobby", players: [player], timeLeft: 75 };
      rooms.set(roomCode, room); player.room = roomCode;
      send(ws, { type: "joined", id: player.id, code: roomCode }); lobby(room);
    }
    if (msg.type === "join") {
      const room = rooms.get(String(msg.code || "").toUpperCase());
      if (!room) return send(ws, { type: "error", message: "방을 찾을 수 없어요." });
      if (room.state !== "lobby") return send(ws, { type: "error", message: "이미 게임 중인 방이에요." });
      if (room.players.length >= 6) return send(ws, { type: "error", message: "방이 가득 찼어요." });
      player = createPlayer(ws, msg.name); player.room = room.code; room.players.push(player);
      send(ws, { type: "joined", id: player.id, code: room.code }); lobby(room);
    }
    if (!player) return;
    const room = rooms.get(player.room); if (!room) return;
    if (msg.type === "start" && room.hostId === player.id) start(room);
    if (msg.type === "input") player.input = { up: !!msg.up, down: !!msg.down, left: !!msg.left, right: !!msg.right, dash: !!msg.dash, disguise: !!msg.disguise };
  });
  ws.on("close", () => {
    if (!player) return; const room = rooms.get(player.room); if (!room) return;
    room.players = room.players.filter(p => p !== player);
    if (!room.players.length) return rooms.delete(room.code);
    if (room.hostId === player.id) room.hostId = room.players[0].id;
    if (room.state === "playing") finish(room, player.role === "hunter" ? "hiders" : "hunter"); else lobby(room);
  });
});

setInterval(() => {
  rooms.forEach(room => {
    if (room.state !== "playing") return;
    room.timeLeft = Math.max(0, 75 - (Date.now() - room.startedAt) / 1000);
    for (const p of room.players) {
      if (p.caught) continue;
      const i = p.input; let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0), dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
      p.disguised = p.role === "hider" && i.disguise && !dx && !dy;
      if (p.disguised) continue;
      const len = Math.hypot(dx, dy) || 1, speed = (p.role === "hunter" ? 205 : 180) + (i.dash ? 70 : 0);
      p.x = clamp(p.x + dx / len * speed / 20, 24, 936); p.y = clamp(p.y + dy / len * speed / 20, 28, 572);
      if (dx || dy) p.facing = Math.atan2(dy, dx);
    }
    const hunter = room.players.find(p => p.role === "hunter");
    if (hunter) for (const p of room.players.filter(p => p.role === "hider" && !p.caught)) {
      if (Math.hypot(p.x - hunter.x, p.y - hunter.y) < 38) p.caught = true;
    }
    const hiders = room.players.filter(p => p.role === "hider");
    if (hiders.length && hiders.every(p => p.caught)) finish(room, "hunter");
    else if (room.timeLeft <= 0) finish(room, "hiders");
    else broadcast(room, { type: "state", timeLeft: room.timeLeft, players: publicPlayers(room) });
  });
}, 50);

const port = Number(process.env.PORT) || 3000;
server.listen(port, "0.0.0.0", () => console.log(`Meccha Chameleon: http://localhost:${port}`));
