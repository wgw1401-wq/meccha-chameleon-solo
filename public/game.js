"use strict";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const roundValue = document.querySelector("#roundValue");
const timeValue = document.querySelector("#timeValue");
const scoreValue = document.querySelector("#scoreValue");
const dangerValue = document.querySelector("#dangerValue");
const soundButton = document.querySelector("#soundButton");
const menuActions = document.querySelector("#menuActions");
const onlineForm = document.querySelector("#onlineForm");
const lobbyPanel = document.querySelector("#lobbyPanel");
const soloButton = document.querySelector("#soloButton");
const onlineButton = document.querySelector("#onlineButton");
const createButton = document.querySelector("#createButton");
const joinButton = document.querySelector("#joinButton");
const backButton = document.querySelector("#backButton");
const nameInput = document.querySelector("#nameInput");
const roomInput = document.querySelector("#roomInput");
const roomCode = document.querySelector("#roomCode");
const playerList = document.querySelector("#playerList");

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const zones = [
  { x: 34, y: 42, w: 280, h: 205, color: "#e76458", detail: "#f28d72" },
  { x: 333, y: 42, w: 255, h: 205, color: "#e7c94f", detail: "#f7e275" },
  { x: 607, y: 42, w: 319, h: 205, color: "#568fd0", detail: "#78b1ee" },
  { x: 34, y: 266, w: 224, h: 300, color: "#8059b7", detail: "#a378d8" },
  { x: 277, y: 266, w: 340, h: 300, color: "#3f9a70", detail: "#62bc8d" },
  { x: 636, y: 266, w: 290, h: 300, color: "#ce6d9a", detail: "#e692ba" }
];

let state = "menu";
let round = 1;
let score = 0;
let timeLeft = 45;
let lastTime = 0;
let caughtMeter = 0;
let soundOn = false;
let audioContext;
let mode = "menu";
let socket;
let myId;
let onlinePlayers = [];
let onlineHostId;
let onlineCode;
let lastInputSent = 0;

const player = { x: 120, y: 150, r: 18, speed: 180, dash: 100, dashEnergy: 100, disguised: false, zone: 0, facing: 0 };
const hunter = { x: 820, y: 460, r: 22, speed: 105, angle: Math.PI, targetAngle: Math.PI, think: 0, alert: 0, patrolX: 820, patrolY: 460 };

function resetRound() {
  timeLeft = Math.max(29, 46 - round * 2);
  caughtMeter = 0;
  player.x = 100 + Math.random() * 90;
  player.y = 95 + Math.random() * 90;
  player.disguised = false;
  player.dashEnergy = 100;
  hunter.x = 790 + Math.random() * 80;
  hunter.y = 410 + Math.random() * 90;
  hunter.angle = Math.PI;
  hunter.alert = 0;
  choosePatrol();
  updateHud();
}

function startGame() {
  mode = "solo";
  if (state === "gameover") { round = 1; score = 0; }
  state = "playing";
  resetRound();
  overlay.classList.add("hidden");
  beep(440, .06);
}

function connectOnline(action) {
  if (socket && socket.readyState <= 1) socket.close();
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}`);
  overlayText.textContent = "서버에 연결 중…";
  socket.addEventListener("open", () => socket.send(JSON.stringify(action)));
  socket.addEventListener("message", event => handleOnlineMessage(JSON.parse(event.data)));
  socket.addEventListener("close", () => {
    if (mode === "online") showOnlineError("서버 연결이 끊어졌어요. 다시 접속해 주세요.");
  });
}

function handleOnlineMessage(msg) {
  if (msg.type === "error") return showOnlineError(msg.message);
  if (msg.type === "joined") { myId = msg.id; onlineCode = msg.code; mode = "online"; }
  if (msg.type === "lobby") {
    state = "lobby"; onlinePlayers = msg.players; onlineHostId = msg.hostId;
    overlayTitle.textContent = "온라인 대기실";
    overlayText.textContent = myId === onlineHostId ? "친구에게 방 코드를 알려주고 게임을 시작하세요." : "방장이 게임을 시작할 때까지 기다려 주세요.";
    onlineForm.classList.add("hidden"); menuActions.classList.add("hidden"); lobbyPanel.classList.remove("hidden"); overlay.classList.remove("hidden");
    roomCode.textContent = msg.code;
    playerList.innerHTML = msg.players.map(p => `<li>${p.id === msg.hostId ? "★ " : ""}${escapeHtml(p.name)}</li>`).join("");
    startButton.classList.toggle("hidden", myId !== onlineHostId);
    startButton.textContent = "온라인 게임 시작";
  }
  if (msg.type === "started") {
    state = "onlinePlaying"; onlinePlayers = msg.players; timeLeft = msg.timeLeft;
    overlay.classList.add("hidden"); lobbyPanel.classList.add("hidden"); startButton.classList.add("hidden");
    beep(540, .08);
  }
  if (msg.type === "state") { onlinePlayers = msg.players; timeLeft = msg.timeLeft; updateOnlineHud(); }
  if (msg.type === "ended") {
    state = "lobby"; onlinePlayers = msg.players;
    const me = onlinePlayers.find(p => p.id === myId);
    const won = (me?.role === "hunter" && msg.winner === "hunter") || (me?.role === "hider" && msg.winner === "hiders");
    overlayTitle.textContent = won ? "승리!" : "패배!";
    overlayText.textContent = msg.winner === "hunter" ? "술래가 모든 카멜레온을 잡았습니다." : "카멜레온들이 제한 시간 동안 살아남았습니다.";
    lobbyPanel.classList.add("hidden"); startButton.classList.add("hidden"); overlay.classList.remove("hidden");
    beep(won ? 720 : 150, .16);
  }
}

function escapeHtml(value) {
  const div = document.createElement("div"); div.textContent = value; return div.innerHTML;
}
function showOnlineError(message) {
  overlayText.textContent = message; onlineForm.classList.remove("hidden"); lobbyPanel.classList.add("hidden");
}
function onlineInput(now) {
  if (!socket || socket.readyState !== WebSocket.OPEN || now - lastInputSent < 45) return;
  lastInputSent = now;
  socket.send(JSON.stringify({ type: "input", up: keys.has("ArrowUp") || keys.has("KeyW"), down: keys.has("ArrowDown") || keys.has("KeyS"), left: keys.has("ArrowLeft") || keys.has("KeyA"), right: keys.has("ArrowRight") || keys.has("KeyD"), dash: keys.has("ShiftLeft") || keys.has("ShiftRight"), disguise: keys.has("Space") }));
}
function updateOnlineHud() {
  const me = onlinePlayers.find(p => p.id === myId);
  roundValue.textContent = onlineCode || "ONLINE";
  timeValue.textContent = Math.max(0, timeLeft).toFixed(1);
  scoreValue.textContent = me?.role === "hunter" ? "술래" : me?.caught ? "잡힘" : "생존";
  dangerValue.textContent = me?.role === "hunter" ? "추격하라!" : me?.disguised ? "위장 중" : "도망쳐!";
  dangerValue.style.color = me?.role === "hunter" ? "#ff5e78" : "#d7ff45";
}

function zoneAt(x, y) {
  return zones.findIndex(z => x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h);
}

function choosePatrol() {
  const z = zones[Math.floor(Math.random() * zones.length)];
  hunter.patrolX = z.x + 45 + Math.random() * (z.w - 90);
  hunter.patrolY = z.y + 45 + Math.random() * (z.h - 90);
  hunter.think = 1.7 + Math.random() * 2.5;
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function canSeePlayer() {
  const dx = player.x - hunter.x;
  const dy = player.y - hunter.y;
  const distance = Math.hypot(dx, dy);
  const sight = 215 + round * 14;
  if (distance > sight) return false;
  const inCone = Math.abs(angleDelta(hunter.angle, Math.atan2(dy, dx))) < .6;
  if (!inCone) return false;
  const sameZone = zoneAt(player.x, player.y) === zoneAt(hunter.x, hunter.y);
  if (!sameZone && distance > 115) return false;
  const camouflage = player.disguised && player.zone >= 0 ? .12 : 1;
  return Math.random() < camouflage;
}

function update(dt) {
  if (state !== "playing") return;
  timeLeft -= dt;
  if (timeLeft <= 0) return winRound();

  player.zone = zoneAt(player.x, player.y);
  player.disguised = keys.has("Space") && player.zone >= 0;
  let dx = 0, dy = 0;
  if (!player.disguised) {
    if (keys.has("ArrowLeft") || keys.has("KeyA")) dx--;
    if (keys.has("ArrowRight") || keys.has("KeyD")) dx++;
    if (keys.has("ArrowUp") || keys.has("KeyW")) dy--;
    if (keys.has("ArrowDown") || keys.has("KeyS")) dy++;
  }
  const moving = dx || dy;
  if (moving) {
    const len = Math.hypot(dx, dy);
    const dashing = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && player.dashEnergy > 0;
    const speed = player.speed + (dashing ? player.dash : 0);
    player.x += dx / len * speed * dt;
    player.y += dy / len * speed * dt;
    player.facing = Math.atan2(dy, dx);
    player.dashEnergy += (dashing ? -40 : 15) * dt;
  } else player.dashEnergy += 22 * dt;
  player.dashEnergy = Math.max(0, Math.min(100, player.dashEnergy));
  player.x = Math.max(24, Math.min(W - 24, player.x));
  player.y = Math.max(28, Math.min(H - 28, player.y));

  const sees = canSeePlayer();
  if (sees) hunter.alert = Math.min(1, hunter.alert + dt * 3.2);
  else hunter.alert = Math.max(0, hunter.alert - dt * .75);
  if (hunter.alert > .42) {
    hunter.patrolX = player.x;
    hunter.patrolY = player.y;
  } else {
    hunter.think -= dt;
    if (hunter.think <= 0 || Math.hypot(hunter.x - hunter.patrolX, hunter.y - hunter.patrolY) < 18) choosePatrol();
  }

  const hx = hunter.patrolX - hunter.x;
  const hy = hunter.patrolY - hunter.y;
  hunter.targetAngle = Math.atan2(hy, hx);
  hunter.angle += angleDelta(hunter.angle, hunter.targetAngle) * Math.min(1, dt * 3.1);
  const hunterSpeed = hunter.speed + round * 8 + hunter.alert * 70;
  hunter.x += Math.cos(hunter.angle) * hunterSpeed * dt;
  hunter.y += Math.sin(hunter.angle) * hunterSpeed * dt;

  const distance = Math.hypot(player.x - hunter.x, player.y - hunter.y);
  if (distance < player.r + hunter.r + 4) caughtMeter += dt * (player.disguised ? .42 : 1.5);
  else caughtMeter = Math.max(0, caughtMeter - dt * .8);
  if (caughtMeter >= 1) loseGame();
  updateHud();
}

function winRound() {
  score += 1000 + Math.round(player.dashEnergy * 3) + round * 250;
  beep(720, .12);
  if (round >= 3) {
    state = "gameover";
    showOverlay("완벽한 위장!", `3라운드를 모두 생존했어요. 최종 점수 ${score.toLocaleString()}점!`, "다시 플레이");
  } else {
    round++;
    state = "between";
    showOverlay(`${round - 1}라운드 생존!`, "다음 술래는 더 빠르고 시야도 넓어요.", "다음 라운드");
  }
}

function loseGame() {
  state = "gameover";
  beep(130, .22);
  showOverlay("들켰다!", `AI 술래에게 잡혔어요. 획득 점수 ${score.toLocaleString()}점`, "다시 도전");
}

function showOverlay(title, text, button) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = button;
  overlay.classList.remove("hidden");
}

function updateHud() {
  roundValue.textContent = `${round} / 3`;
  timeValue.textContent = Math.max(0, timeLeft).toFixed(1);
  scoreValue.textContent = score.toLocaleString();
  const danger = hunter.alert > .62 ? "추적 중!" : hunter.alert > .15 ? "의심" : player.disguised ? "위장 중" : "안전";
  dangerValue.textContent = danger;
  dangerValue.style.color = hunter.alert > .62 ? "#ff5e78" : hunter.alert > .15 ? "#ffd45e" : "#d7ff45";
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawMap() {
  ctx.fillStyle = "#151b2b";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    roundedRect(z.x, z.y, z.w, z.h, 18);
    ctx.fillStyle = z.color;
    ctx.fill();
    ctx.globalAlpha = .18;
    ctx.fillStyle = z.detail;
    for (let j = 0; j < 9; j++) {
      ctx.beginPath();
      const px = z.x + ((j * 71 + i * 43) % Math.max(50, z.w - 30)) + 15;
      const py = z.y + ((j * 53 + i * 29) % Math.max(50, z.h - 30)) + 15;
      ctx.arc(px, py, 8 + (j % 3) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawSight() {
  const range = 215 + round * 14;
  const gradient = ctx.createRadialGradient(hunter.x, hunter.y, 10, hunter.x, hunter.y, range);
  gradient.addColorStop(0, hunter.alert > .4 ? "rgba(255,70,90,.35)" : "rgba(255,239,135,.26)");
  gradient.addColorStop(1, "rgba(255,239,135,0)");
  ctx.beginPath();
  ctx.moveTo(hunter.x, hunter.y);
  ctx.arc(hunter.x, hunter.y, range, hunter.angle - .6, hunter.angle + .6);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawChameleon() {
  const color = player.disguised && player.zone >= 0 ? zones[player.zone].color : "#d7ff45";
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  ctx.globalAlpha = player.disguised ? .72 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(-17, 1, 12, .3, Math.PI * 1.8);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(17, -5, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#101522";
  ctx.beginPath(); ctx.arc(20, -8, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (player.disguised) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "700 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("위장", player.x, player.y - 27);
  }
}

function drawHunter() {
  ctx.save();
  ctx.translate(hunter.x, hunter.y);
  ctx.rotate(hunter.angle);
  ctx.fillStyle = hunter.alert > .4 ? "#ff5e78" : "#252b3a";
  ctx.beginPath(); ctx.arc(0, 0, hunter.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#f8f7ef";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(8, -3, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(23, 12); ctx.stroke();
  ctx.restore();
  if (hunter.alert > .38) {
    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("!", hunter.x, hunter.y - 31);
  }
}

function drawOnlinePlayers() {
  for (const p of onlinePlayers) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.facing || 0);
    ctx.globalAlpha = p.caught ? .25 : p.disguised ? .55 : 1;
    ctx.fillStyle = p.role === "hunter" ? "#ff5e78" : p.color;
    if (p.role === "hunter") {
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(8, -3, 8, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(23, 12); ctx.stroke();
    } else {
      ctx.strokeStyle = p.color; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(-17, 1, 12, .3, Math.PI * 1.8); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(17, -5, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#101522"; ctx.beginPath(); ctx.arc(20, -8, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = p.id === myId ? "#d7ff45" : "#fff"; ctx.font = "700 12px system-ui"; ctx.textAlign = "center";
    ctx.fillText(`${p.id === myId ? "▼ " : ""}${p.name}${p.caught ? " (잡힘)" : ""}`, p.x, p.y - 31);
  }
}

function drawEnergy() {
  ctx.fillStyle = "rgba(8,11,18,.62)";
  roundedRect(28, H - 25, 170, 9, 5); ctx.fill();
  ctx.fillStyle = "#d7ff45";
  roundedRect(28, H - 25, 170 * player.dashEnergy / 100, 9, 5); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.font = "700 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("DASH", 28, H - 31);
}

function draw() {
  drawMap();
  if (mode === "online") { drawOnlinePlayers(); return; }
  drawSight();
  drawChameleon();
  drawHunter();
  drawEnergy();
}

function frame(now) {
  const dt = Math.min(.034, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (state === "onlinePlaying") onlineInput(now); else update(dt);
  draw();
  requestAnimationFrame(frame);
}

function beep(frequency, duration) {
  if (!soundOn) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.045, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

addEventListener("keydown", event => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
});
addEventListener("keyup", event => keys.delete(event.code));
addEventListener("blur", () => keys.clear());
startButton.addEventListener("click", () => {
  if (mode === "online") socket?.send(JSON.stringify({ type: "start" })); else startGame();
});
soloButton.addEventListener("click", startGame);
onlineButton.addEventListener("click", () => { menuActions.classList.add("hidden"); onlineForm.classList.remove("hidden"); overlayTitle.textContent = "친구와 온라인 플레이"; overlayText.textContent = "방을 만들거나 친구의 방 코드를 입력하세요."; });
backButton.addEventListener("click", () => { onlineForm.classList.add("hidden"); menuActions.classList.remove("hidden"); overlayTitle.textContent = "색 속에 숨어라!"; overlayText.textContent = "같은 색 구역에 들어가 위장하고, AI 또는 사람 술래의 시선을 피하세요."; });
createButton.addEventListener("click", () => connectOnline({ type: "create", name: nameInput.value }));
joinButton.addEventListener("click", () => connectOnline({ type: "join", name: nameInput.value, code: roomInput.value.trim().toUpperCase() }));
roomCode.addEventListener("click", () => navigator.clipboard?.writeText(onlineCode));
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? "♪ ON" : "♪ OFF";
  soundButton.setAttribute("aria-label", soundOn ? "소리 끄기" : "소리 켜기");
  beep(550, .06);
});
document.querySelectorAll("[data-key]").forEach(button => {
  const code = button.dataset.key;
  const down = event => { event.preventDefault(); keys.add(code); };
  const up = event => { event.preventDefault(); keys.delete(code); };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("pointerleave", up);
});

resetRound();
requestAnimationFrame(frame);
