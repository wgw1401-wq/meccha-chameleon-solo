import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";

const $ = s => document.querySelector(s);
const canvas = $("#gameCanvas"), menu = $("#menu"), hud = $("#hud"), crosshair = $("#crosshair"), colorPanel = $("#colorPanel");
const mainActions = $("#mainActions"), joinForm = $("#joinForm"), lobby = $("#lobby"), statusText = $("#statusText");
const timer = $("#timer"), survivors = $("#survivors"), roleLabel = $("#role"), phaseLabel = $("#phaseLabel"), hudRoom = $("#hudRoom");
const roomCode = $("#roomCode"), playerList = $("#playerList"), lobbyHint = $("#lobbyHint"), startButton = $("#startButton");
const nameInput = $("#nameInput"), roomInput = $("#roomInput"), colorInput = $("#colorInput"), hexOutput = $("#hexOutput"), palette = $("#palette");
const menuDescription = $("#menuDescription");
const sampleButton = $("#sampleButton");
const resumeHint = $("#resumeHint");
const soloButton = $("#soloButton");
const sensitivityInput = $("#sensitivityInput"), sensitivityOutput = $("#sensitivityOutput");

const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9ba7b0); scene.fog = new THREE.Fog(0x9ba7b0, 28, 68);
const camera = new THREE.PerspectiveCamera(67, innerWidth / innerHeight, .1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xdcecff, 0x485044, 2.1)); const sun = new THREE.DirectionalLight(0xfff4dc, 2.7); sun.position.set(-18, 30, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35; scene.add(sun);

const map = new THREE.Group(); scene.add(map);
const LOCAL_OBSTACLES=[{x:-13,z:-8,hx:4.9,hz:4.4},{x:11,z:-13,hx:5.9,hz:3.4},{x:13,z:10,hx:4.4,hz:5.4},{x:-11,z:13,hx:6.4,hz:3.9},{x:-3,z:-7,hx:1.9,hz:1.9},{x:3,z:-5,hx:1.65,hz:1.65},{x:-3,z:10,hx:3.4,hz:1},{x:5,z:14,hx:.9,hz:2.9}];
const SURFACES=[{x:0,z:0,color:"#77826e"},{x:-13,z:-8,color:"#b96558"},{x:11,z:-13,color:"#d0b84e"},{x:13,z:10,color:"#547a9a"},{x:-11,z:13,color:"#6f8d67"},{x:-3,z:-7,color:"#9d6f43"},{x:3,z:-5,color:"#d79d56"},{x:5,z:14,color:"#8d5f86"}];
const localBlocked=(x,z)=>LOCAL_OBSTACLES.some(o=>Math.abs(x-o.x)<o.hx&&Math.abs(z-o.z)<o.hz);
const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: .02 });
function box(name, x,y,z, sx,sy,sz,color) { const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(color));m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;map.add(m);return m; }
box("floor",0,-.25,0,48,.5,48,0x77826e);
box("wall",0,2.5,-24,48,5,1,0xd8c8aa);box("wall",0,2.5,24,48,5,1,0x717d91);box("wall",-24,2.5,0,1,5,48,0xb6655a);box("wall",24,2.5,0,1,5,48,0x586d5a);
box("building",-13,3,-8,9,6,8,0xb96558);box("building",11,2.5,-13,11,5,6,0xd0b84e);box("building",13,3.5,10,8,7,10,0x547a9a);box("building",-11,2,13,12,4,7,0x6f8d67);
box("crate",-3,1,-7,3,2,3,0x9d6f43);box("crate",3,.75,-5,2.5,1.5,2.5,0xd79d56);box("bench",-3,.5,10,6,1,1.2,0x675247);box("sign",5,2,14,1,4,5,0x8d5f86);
for(let i=0;i<14;i++){const x=-20+(i*7.3)%40,z=-19+(i*11.7)%38;const trunk=box("tree",x,1.4,z,.65,2.8,.65,0x68513d);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.1,1),mat(i%2?0x4f7954:0x657f46));crown.position.set(x,3.8,z);crown.castShadow=true;map.add(crown);}
const grid=new THREE.GridHelper(48,24,0x89917d,0x89917d);grid.position.y=.02;grid.material.opacity=.16;grid.material.transparent=true;scene.add(grid);

const playerMeshes = new Map();
function createAvatar(p) {
  const group=new THREE.Group();group.userData.playerId=p.id;
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.55,1.05,5,10),mat(p.role==="hunter"?0x171a20:p.color));body.position.y=1.15;body.castShadow=true;body.userData.playerId=p.id;group.add(body);
  const eyeMat=mat(p.role==="hunter"?0xff3b58:0x111318);for(const x of [-.2,.2]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),eyeMat);eye.position.set(x,1.55,.52);group.add(eye)}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.75,24),new THREE.MeshBasicMaterial({color:0xd9ff43,side:THREE.DoubleSide,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;ring.visible=p.id===myId;group.add(ring);
  if(p.role==="hunter"){
    const gun=new THREE.Group(),gunBody=new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.85),new THREE.MeshStandardMaterial({color:0x303642,metalness:.7,roughness:.3}));
    gunBody.position.z=.42;gun.add(gunBody);const grip=new THREE.Mesh(new THREE.BoxGeometry(.14,.36,.18),new THREE.MeshStandardMaterial({color:0x17191e,roughness:.8}));grip.position.set(0,-.2,.15);grip.rotation.x=-.28;gun.add(grip);
    const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.18,10),new THREE.MeshStandardMaterial({color:0x111318,metalness:.8}));muzzle.rotation.x=Math.PI/2;muzzle.position.z=.92;gun.add(muzzle);gun.position.set(.55,1.25,.35);group.add(gun);group.userData.gun=gun;
  }
  group.userData.body=body;scene.add(group);playerMeshes.set(p.id,group);return group;
}
function syncPlayers(list) {
  const ids=new Set(list.map(p=>p.id)); for(const [id,m] of playerMeshes)if(!ids.has(id)){scene.remove(m);playerMeshes.delete(id)}
  const me=list.find(p=>p.id===myId);
  list.forEach(p=>{let m=playerMeshes.get(p.id)||createAvatar(p);m.userData.target=new THREE.Vector3(p.x,p.y||0,p.z);m.userData.player=p;m.userData.body.material.color.set(p.role==="hunter"?0x171a20:p.color);const hunterWaiting=(me?.role==="hunter"&&phase==="prepare"&&p.role==="hider")||(playMode==="solo"&&phase==="prepare"&&p.role==="hunter");m.visible=(!p.found||p.id===myId)&&!hunterWaiting;});
}

let socket,myId,hostId,currentRoom,players=[],phase="lobby",remaining=0,gameActive=false,yaw=0,pitch=.28,lastSend=0,lastAttack=0,aimTarget,playMode="online";
let soloPhaseStarted=0,soloAiTarget=new THREE.Vector3(),soloAiThink=0,soloDetect=0,soloChase=0;
const keys=new Set(),raycaster=new THREE.Raycaster();
function wsSend(data){if(playMode==="online"&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
function connect(payload){
  playMode="online";
  statusText.textContent="서버 연결 중…";socket?.close();
  const isLegacyStatic=location.hostname==="meccha-chameleon-solo.onrender.com";
  const socketHost=isLegacyStatic?"meccha-chameleon-online.onrender.com":location.host;
  socket=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${socketHost}`);
  const timeout=setTimeout(()=>{if(socket?.readyState!==WebSocket.OPEN){statusText.textContent="서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";socket?.close()}},12000);
  socket.onopen=()=>{clearTimeout(timeout);statusText.textContent="";wsSend(payload)};
  socket.onmessage=e=>onMessage(JSON.parse(e.data));
  socket.onerror=()=>{clearTimeout(timeout);statusText.textContent="게임 서버에 연결하지 못했습니다."};
  socket.onclose=()=>{clearTimeout(timeout);if(playMode!=="online")return;if(gameActive)showResult("연결 종료","서버 연결이 끊어졌습니다.");else if(!myId)statusText.textContent="게임 서버에 연결하지 못했습니다. 다시 시도해 주세요."};
}
function onMessage(msg){
  if(msg.type==="error"){statusText.textContent=msg.message;return}
  if(msg.type==="joined"){myId=msg.id;currentRoom=msg.code;hudRoom.textContent=msg.code}
  if(msg.type==="lobby"){hostId=msg.hostId;players=msg.players;showLobby(msg)}
  if(msg.type==="started"){players=msg.players;phase=msg.phase;remaining=msg.duration;beginGame()}
  if(msg.type==="phase"){phase=msg.phase;remaining=msg.duration;const me=players.find(p=>p.id===myId);toast(phase==="hunt"?(me?.role==="hunter"?"사냥 시작 — 클릭해서 찾아내세요!":"술래가 풀려났습니다!"):"준비 시작");updatePanels()}
  if(msg.type==="state"){players=msg.players;phase=msg.phase;remaining=msg.remaining;syncPlayers(players);updateHud()}
  if(msg.type==="found"){const target=players.find(p=>p.id===msg.targetId);if(msg.targetId===myId)toast("발견되었습니다!");else if(msg.by===myId)toast(`${target?.name||"플레이어"} 발견!`)}
  if(msg.type==="shot")showShot(msg.by,msg.targetId);
  if(msg.type==="attackResult"){if(msg.hit)crosshair.classList.add("target");else if(msg.reason!=="cooldown")toast(msg.reason==="range"?"조금 더 가까이 가세요":msg.reason==="blocked"?"벽이 가로막고 있습니다":"빗나갔습니다");setTimeout(()=>crosshair.classList.remove("target"),180)}
  if(msg.type==="ended"){players=msg.players;const me=players.find(p=>p.id===myId),won=(me?.role==="hunter"&&msg.winner==="hunter")||(me?.role==="hider"&&msg.winner==="hiders");showResult(won?"승리":"패배",msg.winner==="hunter"?"술래가 모두를 찾아냈습니다.":"한 명 이상의 숨는 팀이 살아남았습니다.")}
}
function showLobby(msg){gameActive=false;document.exitPointerLock?.();menu.classList.remove("hidden");menuDescription.classList.add("hidden");mainActions.classList.add("hidden");joinForm.classList.add("hidden");lobby.classList.remove("hidden");roomCode.textContent=msg.code;playerList.innerHTML=msg.players.map(p=>`<li>${p.id===msg.hostId?"★ ":""}${safe(p.name)}</li>`).join("");lobbyHint.textContent=myId===msg.hostId?"친구에게 코드를 공유하세요. 최소 2명, 최대 8명":"방장이 시작하기를 기다리는 중";startButton.classList.toggle("hidden",myId!==msg.hostId);statusText.textContent="";hud.classList.add("hidden");colorPanel.classList.add("hidden");crosshair.classList.add("hidden")}
function beginGame(){gameActive=true;menu.classList.add("hidden");hud.classList.remove("hidden");crosshair.classList.remove("hidden");syncPlayers(players);updatePanels();canvas.requestPointerLock?.();const me=players.find(p=>p.id===myId);toast(me?.role==="hunter"?"당신은 술래 — 30초 동안 대기하세요":"30초 안에 색을 고르고 숨으세요")}
function showResult(title,text){gameActive=false;document.exitPointerLock?.();menu.classList.remove("hidden");menuDescription.classList.remove("hidden");lobby.classList.add("hidden");joinForm.classList.add("hidden");mainActions.classList.toggle("hidden",playMode!=="solo");menuDescription.innerHTML=`<b>${title}</b><br>${text}<br><small>${playMode==="solo"?"다시 도전하거나 온라인 방을 만들어 보세요.":"잠시 후 대기실로 돌아갑니다."}</small>`;statusText.textContent=""}
function updatePanels(){const me=players.find(p=>p.id===myId);colorPanel.classList.toggle("hidden",!(me?.role==="hider"&&phase==="prepare"));phaseLabel.textContent=phase==="prepare"?"준비 시간":playMode==="solo"&&soloChase>0?"AI 추적 중!":"추격 시간";roleLabel.textContent=me?.found?"발견됨 · 관전":me?.airLocked?"공중 고정":me?.role==="hunter"?"술래 팀":"숨는 팀"}
function updateHud(){const h=players.filter(p=>p.role==="hider"),alive=h.filter(p=>!p.found);timer.textContent=`${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(Math.ceil(remaining%60)).padStart(2,"0")}`;survivors.textContent=`${alive.length} / ${h.length}`;updatePanels()}
function safe(v){const d=document.createElement("div");d.textContent=v;return d.innerHTML}
function toast(text){const t=$("#toast");t.textContent=text;t.classList.remove("hidden","show");void t.offsetWidth;t.classList.add("show");setTimeout(()=>t.classList.add("hidden"),2100)}
function showShot(shooterId,targetId){
  const shooter=playerMeshes.get(shooterId);if(!shooter)return;const start=shooter.position.clone().add(new THREE.Vector3(0,1.35,0));let end;
  const target=playerMeshes.get(targetId);if(target)end=target.position.clone().add(new THREE.Vector3(0,1.1,0));else{const direction=new THREE.Vector3(Math.sin(shooter.rotation.y),0,Math.cos(shooter.rotation.y));end=start.clone().add(direction.multiplyScalar(8))}
  const geometry=new THREE.BufferGeometry().setFromPoints([start,end]),line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffe178,transparent:true,opacity:1}));scene.add(line);
  const flash=new THREE.PointLight(0xffb52e,5,5);flash.position.copy(start);scene.add(flash);setTimeout(()=>{scene.remove(line,flash);geometry.dispose();line.material.dispose()},110);
}

function startSolo(){
  playMode="solo";socket?.close();myId="solo-player";currentRoom="SOLO";phase="prepare";remaining=30;soloPhaseStarted=performance.now();soloDetect=0;soloChase=0;soloAiThink=0;
  players=[{id:myId,name:nameInput.value||"PLAYER",x:-20,y:0,z:-20,vy:0,airLocked:false,yaw:0,role:"hider",found:false,color:colorInput.value},{id:"solo-ai",name:"AI SEEKER",x:0,y:0,z:20,vy:0,airLocked:false,yaw:Math.PI,role:"hunter",found:false,color:"#171a20"}];
  hudRoom.textContent="SOLO";beginGame();updateHud();
}
function colorMatch(player){
  let closest=SURFACES[0],best=Infinity;for(const surface of SURFACES){const distance=Math.hypot(player.x-surface.x,player.z-surface.z);if(distance<best){best=distance;closest=surface}}
  const a=new THREE.Color(player.color),b=new THREE.Color(closest.color);return 1-Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b)/Math.sqrt(3);
}
function clearLocalSight(from,to){
  const origin=new THREE.Vector3(from.x,1.2,from.z),direction=new THREE.Vector3(to.x-from.x,0,to.z-from.z),distance=direction.length();direction.normalize();const sightRay=new THREE.Raycaster(origin,direction,0,distance);return sightRay.intersectObjects(map.children,true).length===0;
}
function chooseAiPatrol(){soloAiTarget.set(-20+Math.random()*40,0,-20+Math.random()*40);if(localBlocked(soloAiTarget.x,soloAiTarget.z))chooseAiPatrol();soloAiThink=2+Math.random()*3}
function updateSolo(dt,now){
  const me=players[0],ai=players[1];remaining=Math.max(0,(phase==="prepare"?30:180)-(now-soloPhaseStarted)/1000);
  if(remaining<=0){if(phase==="prepare"){phase="hunt";remaining=180;soloPhaseStarted=now;chooseAiPatrol();toast("AI 술래가 등장했습니다!");syncPlayers(players)}else{return showResult("생존 성공","3분 동안 AI 술래에게 발견되지 않았습니다.")}}
  if(keys.has("Space")&&!me.jumpHeld&&me.y<=.01){me.vy=8.2;me.airLocked=false}me.jumpHeld=keys.has("Space");
  if(keys.has("KeyF")&&!me.lockHeld&&me.y>.15){me.airLocked=!me.airLocked;toast(me.airLocked?"공중 고정 ON":"공중 고정 OFF")}me.lockHeld=keys.has("KeyF");
  if(!me.airLocked){me.vy-=20*dt;me.y=Math.max(0,me.y+me.vy*dt);if(me.y===0)me.vy=0}
  let forward=(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0),side=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);const moving=!!(forward||side)&&!me.airLocked,speed=5.2*(keys.has("ShiftLeft")?1.45:1);
  if(moving){const len=Math.hypot(forward,side),dx=(Math.sin(yaw)*forward-Math.cos(yaw)*side)/len*speed*dt,dz=(Math.cos(yaw)*forward+Math.sin(yaw)*side)/len*speed*dt;const nx=THREE.MathUtils.clamp(me.x+dx,-22.5,22.5),nz=THREE.MathUtils.clamp(me.z+dz,-22.5,22.5);if(!localBlocked(nx,me.z))me.x=nx;if(!localBlocked(me.x,nz))me.z=nz;me.yaw=yaw}
  if(phase==="hunt"){
    const dx=me.x-ai.x,dz=me.z-ai.z,distance=Math.hypot(dx,dz),toward=Math.atan2(dx,dz),angle=Math.abs(Math.atan2(Math.sin(toward-ai.yaw),Math.cos(toward-ai.yaw)));const match=colorMatch(me),vision=moving?16:5+(1-match)*11;const visible=distance<vision&&angle<.72&&clearLocalSight(ai,me);
    soloDetect=THREE.MathUtils.clamp(soloDetect+(visible?dt*1.45:-dt*.7),0,1);if(soloDetect>.55)soloChase=4;else soloChase=Math.max(0,soloChase-dt);
    soloAiThink-=dt;if(soloChase>0)soloAiTarget.set(me.x,0,me.z);else if(soloAiThink<=0||Math.hypot(ai.x-soloAiTarget.x,ai.z-soloAiTarget.z)<1)chooseAiPatrol();
    const tx=soloAiTarget.x-ai.x,tz=soloAiTarget.z-ai.z,len=Math.hypot(tx,tz)||1;ai.yaw=Math.atan2(tx,tz);const aiSpeed=(soloChase>0?6.3:4.1)*dt,nx=ai.x+tx/len*aiSpeed,nz=ai.z+tz/len*aiSpeed;if(!localBlocked(nx,ai.z))ai.x=nx;else soloAiThink=0;if(!localBlocked(ai.x,nz))ai.z=nz;else soloAiThink=0;
    if(Math.hypot(dx,me.y-ai.y,dz)<1.25){me.found=true;syncPlayers(players);return showResult("AI에게 발견됨",`위장 일치도 ${Math.round(match*100)}% — 주변색과 더 비슷하게 맞춰보세요.`)}
  }
  syncPlayers(players);updateHud();
}

const paletteColors=["#ef4444","#f97316","#facc15","#4ade80","#38bdf8","#3b82f6","#8b5cf6","#ec4899","#e5e7eb","#64748b","#8b6b4a","#365c40","#b96558","#d0b84e"];
function pickColor(color){colorInput.value=color;hexOutput.value=color.toUpperCase();document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("active",b.dataset.color===color));if(playMode==="solo"&&players[0]){players[0].color=color;syncPlayers(players)}else wsSend({type:"color",color})}
function sampleSurfaceColor(){
  if(!gameActive)return;const me=players.find(p=>p.id===myId);if(me?.role!=="hider"||phase!=="prepare")return toast("색 복사는 준비 시간에만 가능합니다");
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObjects(map.children,true)[0];
  const surface=hit?.object?.material?.color;if(!surface)return toast("복사할 표면을 조준하세요");
  const color=`#${surface.getHexString()}`;pickColor(color);toast(`${color.toUpperCase()} 색상 복사 완료`);
}
paletteColors.forEach(c=>{const b=document.createElement("button");b.className="swatch";b.dataset.color=c;b.style.background=c;b.title=c;b.onclick=()=>pickColor(c);palette.appendChild(b)});colorInput.oninput=e=>pickColor(e.target.value);
sampleButton.onclick=sampleSurfaceColor;

$("#createButton").onclick=()=>{mainActions.classList.add("hidden");joinForm.classList.remove("hidden");roomInput.classList.add("hidden");joinButton.textContent="새 방 만들기 →";joinButton.dataset.mode="create"};
soloButton.onclick=startSolo;
$("#showJoinButton").onclick=()=>{mainActions.classList.add("hidden");joinForm.classList.remove("hidden");roomInput.classList.remove("hidden");joinButton.textContent="입장하기 →";joinButton.dataset.mode="join"};
$("#backButton").onclick=()=>{joinForm.classList.add("hidden");mainActions.classList.remove("hidden");statusText.textContent=""};
$("#joinButton").onclick=()=>connect({type:joinButton.dataset.mode||"join",name:nameInput.value,code:roomInput.value.trim().toUpperCase()});
startButton.onclick=()=>wsSend({type:"start"});roomCode.onclick=()=>{navigator.clipboard?.writeText(currentRoom);toast("방 코드 복사됨")};

addEventListener("keydown",e=>{if(["Space","KeyF","BracketLeft","BracketRight"].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==="KeyE"&&!e.repeat)sampleSurfaceColor();if(e.code==="BracketLeft"&&!e.repeat)setSensitivity(sensitivity-.1,true);if(e.code==="BracketRight"&&!e.repeat)setSensitivity(sensitivity+.1,true)});addEventListener("keyup",e=>keys.delete(e.code));addEventListener("blur",()=>keys.clear());
let sensitivity=Number(localStorage.getItem("colorHideSensitivity"))||1;function setSensitivity(value,announce=false){sensitivity=THREE.MathUtils.clamp(Math.round(value*10)/10,.2,2.5);sensitivityInput.value=String(sensitivity);sensitivityOutput.value=sensitivity.toFixed(1);localStorage.setItem("colorHideSensitivity",String(sensitivity));if(announce)toast(`마우스 감도 ${sensitivity.toFixed(1)}`)}setSensitivity(sensitivity);sensitivityInput.oninput=()=>setSensitivity(Number(sensitivityInput.value));
addEventListener("mousemove",e=>{if(document.pointerLockElement!==canvas||!gameActive)return;yaw-=e.movementX*.0023*sensitivity;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0018*sensitivity,-.15,.85)});
canvas.addEventListener("click",()=>{if(!gameActive)return;if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return}const me=players.find(p=>p.id===myId);if(me?.role!=="hunter"||phase!=="hunt"||Date.now()-lastAttack<650)return;lastAttack=Date.now();wsSend({type:"attack",targetId:aimTarget||null});if(!aimTarget)toast("빗나갔습니다")});
document.addEventListener("pointerlockchange",()=>resumeHint.classList.toggle("hidden",!gameActive||document.pointerLockElement===canvas));resumeHint.onclick=()=>canvas.requestPointerLock?.();
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

const clock=new THREE.Clock();
function animate(now){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);for(const m of playerMeshes.values()){if(m.userData.target)m.position.lerp(m.userData.target,Math.min(1,dt*14));m.rotation.y=m.userData.player?.yaw||0}
  if(gameActive&&playMode==="solo")updateSolo(dt,now);
  const me=players.find(p=>p.id===myId),mine=playerMeshes.get(myId);let followed=mine;if(me?.found)followed=[...playerMeshes.values()].find(m=>m.userData.player?.role==="hider"&&!m.userData.player?.found)||playerMeshes.get(players.find(p=>p.role==="hunter")?.id);if(followed){const target=followed.position.clone().add(new THREE.Vector3(0,1.25,0));const dist=5.8,offset=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch)*dist,2.1+Math.sin(pitch)*dist,-Math.cos(yaw)*Math.cos(pitch)*dist);camera.position.lerp(target.clone().add(offset),Math.min(1,dt*12));camera.lookAt(target);if(mine)mine.visible=true}
  else{camera.position.set(16,18,25);camera.lookAt(0,0,0)}
  aimTarget=undefined;if(gameActive&&me?.role==="hunter"&&phase==="hunt"){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObjects([...playerMeshes.values()],true).find(h=>{const id=h.object.userData.playerId,p=players.find(item=>item.id===id);return id&&id!==myId&&p&&!p.found});aimTarget=hit?.object.userData.playerId}crosshair.classList.toggle("target",!!aimTarget);crosshair.classList.toggle("cooldown",now-lastAttack<650);
  if(gameActive&&playMode==="online"&&now-lastSend>45){lastSend=now;wsSend({type:"input",forward:keys.has("KeyW"),back:keys.has("KeyS"),left:keys.has("KeyA"),right:keys.has("KeyD"),run:keys.has("ShiftLeft")||keys.has("ShiftRight"),jump:keys.has("Space"),airLock:keys.has("KeyF"),yaw})}
  renderer.render(scene,camera)}
requestAnimationFrame(animate);
