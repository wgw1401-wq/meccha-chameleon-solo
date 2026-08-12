const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const publicDir = path.join(__dirname, "public");
const vendorFile = path.join(__dirname, "node_modules", "three", "build", "three.module.js");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const file = url === "/vendor/three.module.js" ? vendorFile : path.join(publicDir, url === "/" ? "index.html" : url);
  if (file !== vendorFile && !file.startsWith(publicDir)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end("Not found"); } res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" }); res.end(data); });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const COLORS = ["#ef4444", "#f97316", "#facc15", "#4ade80", "#38bdf8", "#8b5cf6", "#ec4899", "#e5e7eb"];
const OBSTACLES = [
  { x: -13, z: -8, hx: 4.9, hz: 4.4 }, { x: 11, z: -13, hx: 5.9, hz: 3.4 },
  { x: 13, z: 10, hx: 4.4, hz: 5.4 }, { x: -11, z: 13, hx: 6.4, hz: 3.9 },
  { x: -3, z: -7, hx: 1.9, hz: 1.9 }, { x: 3, z: -5, hx: 1.65, hz: 1.65 },
  { x: -3, z: 10, hx: 3.4, hz: 1 }, { x: 5, z: 14, hx: .9, hz: 2.9 }
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const blocked = (x, z) => OBSTACLES.some(o => Math.abs(x-o.x)<o.hx && Math.abs(z-o.z)<o.hz);
function clearSight(a, b) {
  const distance = Math.hypot(b.x-a.x,b.z-a.z), steps = Math.ceil(distance/.35);
  for (let n=1;n<steps;n++) if (blocked(a.x+(b.x-a.x)*n/steps,a.z+(b.z-a.z)*n/steps)) return false;
  return true;
}
const send = (ws, data) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(data));
const broadcast = (room, data) => room.players.forEach(p => send(p.ws, data));
const makeCode = () => Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const exposed = room => room.players.map(({ id, name, x, z, yaw, role, found, color }) => ({ id, name, x, z, yaw, role, found, color }));
function lobby(room) { broadcast(room, { type: "lobby", code: room.code, hostId: room.hostId, players: exposed(room) }); }
function player(ws, name) { return { id: crypto.randomUUID(), ws, name: String(name || "PLAYER").trim().slice(0, 12) || "PLAYER", x: 0, z: 0, yaw: 0, role: "hider", found: false, color: COLORS[Math.floor(Math.random() * COLORS.length)], input: {}, lastAttack: 0 }; }

function startGame(room) {
  if (room.players.length < 2) return send(room.players.find(p => p.id === room.hostId)?.ws, { type: "error", message: "최소 2명이 필요합니다." });
  room.state = "playing"; room.phase = "prepare"; room.phaseStarted = Date.now(); room.duration = 30;
  const hunter = Math.floor(Math.random() * room.players.length);
  const spawns = [[-20,-20],[20,-20],[-20,20],[20,20],[-20,0],[20,0],[0,-20],[0,20]];
  room.players.forEach((p, i) => { p.role = i === hunter ? "hunter" : "hider"; p.found = false; p.color = COLORS[i % COLORS.length]; [p.x,p.z] = p.role === "hunter" ? [0,19] : spawns[i]; p.yaw = 0; });
  broadcast(room, { type: "started", phase: room.phase, duration: 30, players: exposed(room) });
}
function endGame(room, winner) { if (room.state !== "playing") return; room.state = "results"; broadcast(room, { type: "ended", winner, players: exposed(room) }); setTimeout(() => { if (!rooms.has(room.code)) return; room.state = "lobby"; lobby(room); }, 4500); }
function setPhase(room, phase, duration) { room.phase = phase; room.duration = duration; room.phaseStarted = Date.now(); broadcast(room, { type: "phase", phase, duration }); }

wss.on("connection", ws => {
  let me;
  ws.on("message", raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "create") {
      let code; do code = makeCode(); while (rooms.has(code)); me = player(ws, msg.name);
      const room = { code, hostId: me.id, players: [me], state: "lobby", phase: "lobby" }; rooms.set(code, room); me.room = code;
      send(ws, { type: "joined", id: me.id, code }); return lobby(room);
    }
    if (msg.type === "join") {
      const room = rooms.get(String(msg.code || "").toUpperCase());
      if (!room) return send(ws, { type: "error", message: "방을 찾을 수 없습니다." });
      if (room.state !== "lobby") return send(ws, { type: "error", message: "이미 진행 중인 방입니다." });
      if (room.players.length >= 8) return send(ws, { type: "error", message: "방이 가득 찼습니다. (최대 8명)" });
      me = player(ws, msg.name); me.room = room.code; room.players.push(me); send(ws, { type: "joined", id: me.id, code: room.code }); return lobby(room);
    }
    if (!me) return; const room = rooms.get(me.room); if (!room) return;
    if (msg.type === "start" && room.hostId === me.id && room.state === "lobby") return startGame(room);
    if (msg.type === "input") me.input = { forward: !!msg.forward, back: !!msg.back, left: !!msg.left, right: !!msg.right, run: !!msg.run, yaw: Number(msg.yaw) || 0 };
    if (msg.type === "color" && me.role === "hider" && room.phase === "prepare" && /^#[0-9a-f]{6}$/i.test(msg.color)) me.color = msg.color;
    if (msg.type === "attack" && me.role === "hunter" && room.phase === "hunt") {
      const now=Date.now();if(now-me.lastAttack<650)return send(me.ws,{type:"attackResult",hit:false,reason:"cooldown"});me.lastAttack=now;
      const target = room.players.find(p => p.id === msg.targetId && p.role === "hider" && !p.found);
      if (!target)return send(me.ws,{type:"attackResult",hit:false,reason:"invalid"});
      if(Math.hypot(target.x-me.x,target.z-me.z)>7.5)return send(me.ws,{type:"attackResult",hit:false,reason:"range"});
      if(!clearSight(me,target))return send(me.ws,{type:"attackResult",hit:false,reason:"blocked"});
      target.found=true;send(me.ws,{type:"attackResult",hit:true,targetId:target.id});broadcast(room,{type:"found",targetId:target.id,by:me.id});
    }
  });
  ws.on("close", () => {
    if (!me) return; const room = rooms.get(me.room); if (!room) return; const wasHunter = me.role === "hunter";
    room.players = room.players.filter(p => p !== me); if (!room.players.length) return rooms.delete(room.code);
    if (room.hostId === me.id) room.hostId = room.players[0].id;
    if (room.state === "playing") endGame(room, wasHunter ? "hiders" : "hunter"); else lobby(room);
  });
});

setInterval(() => rooms.forEach(room => {
  if (room.state !== "playing") return;
  const elapsed = (Date.now() - room.phaseStarted) / 1000, remaining = Math.max(0, room.duration - elapsed);
  if (remaining <= 0) { if (room.phase === "prepare") setPhase(room, "hunt", 180); else return endGame(room, "hiders"); }
  for (const p of room.players) {
    if (p.found || (p.role === "hunter" && room.phase === "prepare")) continue;
    const i = p.input, fx = Math.sin(i.yaw), fz = Math.cos(i.yaw), rx = Math.cos(i.yaw), rz = -Math.sin(i.yaw);
    let dx = fx * ((i.forward?1:0)-(i.back?1:0)) + rx * ((i.right?1:0)-(i.left?1:0));
    let dz = fz * ((i.forward?1:0)-(i.back?1:0)) + rz * ((i.right?1:0)-(i.left?1:0));
    const len = Math.hypot(dx,dz) || 1, speed = (p.role === "hunter" ? 6.2 : 5.2) * (i.run ? 1.45 : 1);
    const nextX=clamp(p.x+dx/len*speed/20,-22.5,22.5),nextZ=clamp(p.z+dz/len*speed/20,-22.5,22.5);
    if(!blocked(nextX,p.z))p.x=nextX;if(!blocked(p.x,nextZ))p.z=nextZ;p.yaw=i.yaw;
  }
  const hiders = room.players.filter(p => p.role === "hider"); if (hiders.length && hiders.every(p => p.found)) return endGame(room, "hunter");
  broadcast(room, { type: "state", phase: room.phase, remaining, players: exposed(room) });
}), 50);

const port = Number(process.env.PORT) || 3000;
server.listen(port, "0.0.0.0", () => console.log(`COLOR HIDE listening on ${port}`));
