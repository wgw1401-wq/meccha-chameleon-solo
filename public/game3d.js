import * as THREE from "/vendor/three.module.js";

const $ = s => document.querySelector(s);
const canvas = $("#gameCanvas"), menu = $("#menu"), hud = $("#hud"), crosshair = $("#crosshair"), colorPanel = $("#colorPanel");
const mainActions = $("#mainActions"), joinForm = $("#joinForm"), lobby = $("#lobby"), statusText = $("#statusText");
const timer = $("#timer"), survivors = $("#survivors"), roleLabel = $("#role"), phaseLabel = $("#phaseLabel"), hudRoom = $("#hudRoom");
const roomCode = $("#roomCode"), playerList = $("#playerList"), lobbyHint = $("#lobbyHint"), startButton = $("#startButton");
const nameInput = $("#nameInput"), roomInput = $("#roomInput"), colorInput = $("#colorInput"), hexOutput = $("#hexOutput"), palette = $("#palette");
const menuDescription = $("#menuDescription");
const sampleButton = $("#sampleButton");

const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9ba7b0); scene.fog = new THREE.Fog(0x9ba7b0, 28, 68);
const camera = new THREE.PerspectiveCamera(67, innerWidth / innerHeight, .1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xdcecff, 0x485044, 2.1)); const sun = new THREE.DirectionalLight(0xfff4dc, 2.7); sun.position.set(-18, 30, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35; scene.add(sun);

const map = new THREE.Group(); scene.add(map);
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
  group.userData.body=body;scene.add(group);playerMeshes.set(p.id,group);return group;
}
function syncPlayers(list) {
  const ids=new Set(list.map(p=>p.id)); for(const [id,m] of playerMeshes)if(!ids.has(id)){scene.remove(m);playerMeshes.delete(id)}
  const me=list.find(p=>p.id===myId);
  list.forEach(p=>{let m=playerMeshes.get(p.id)||createAvatar(p);m.userData.target=new THREE.Vector3(p.x,0,p.z);m.userData.player=p;m.userData.body.material.color.set(p.role==="hunter"?0x171a20:p.color);const hunterWaiting=me?.role==="hunter"&&phase==="prepare"&&p.role==="hider";m.visible=(!p.found||p.id===myId)&&!hunterWaiting;});
}

let socket,myId,hostId,currentRoom,players=[],phase="lobby",remaining=0,gameActive=false,yaw=0,pitch=.28,lastSend=0;
const keys=new Set(),raycaster=new THREE.Raycaster();
function wsSend(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
function connect(payload){statusText.textContent="서버 연결 중…";socket?.close();socket=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}`);socket.onopen=()=>wsSend(payload);socket.onmessage=e=>onMessage(JSON.parse(e.data));socket.onclose=()=>{if(gameActive)showResult("연결 종료","서버 연결이 끊어졌습니다.")};}
function onMessage(msg){
  if(msg.type==="error"){statusText.textContent=msg.message;return}
  if(msg.type==="joined"){myId=msg.id;currentRoom=msg.code;hudRoom.textContent=msg.code}
  if(msg.type==="lobby"){hostId=msg.hostId;players=msg.players;showLobby(msg)}
  if(msg.type==="started"){players=msg.players;phase=msg.phase;remaining=msg.duration;beginGame()}
  if(msg.type==="phase"){phase=msg.phase;remaining=msg.duration;const me=players.find(p=>p.id===myId);toast(phase==="hunt"?(me?.role==="hunter"?"사냥 시작 — 클릭해서 찾아내세요!":"술래가 풀려났습니다!"):"준비 시작");updatePanels()}
  if(msg.type==="state"){players=msg.players;phase=msg.phase;remaining=msg.remaining;syncPlayers(players);updateHud()}
  if(msg.type==="found"){const target=players.find(p=>p.id===msg.targetId);if(msg.targetId===myId)toast("발견되었습니다!");else if(msg.by===myId)toast(`${target?.name||"플레이어"} 발견!`)}
  if(msg.type==="ended"){players=msg.players;const me=players.find(p=>p.id===myId),won=(me?.role==="hunter"&&msg.winner==="hunter")||(me?.role==="hider"&&msg.winner==="hiders");showResult(won?"승리":"패배",msg.winner==="hunter"?"술래가 모두를 찾아냈습니다.":"한 명 이상의 숨는 팀이 살아남았습니다.")}
}
function showLobby(msg){gameActive=false;document.exitPointerLock?.();menu.classList.remove("hidden");menuDescription.classList.add("hidden");mainActions.classList.add("hidden");joinForm.classList.add("hidden");lobby.classList.remove("hidden");roomCode.textContent=msg.code;playerList.innerHTML=msg.players.map(p=>`<li>${p.id===msg.hostId?"★ ":""}${safe(p.name)}</li>`).join("");lobbyHint.textContent=myId===msg.hostId?"친구에게 코드를 공유하세요. 최소 2명, 최대 8명":"방장이 시작하기를 기다리는 중";startButton.classList.toggle("hidden",myId!==msg.hostId);statusText.textContent="";hud.classList.add("hidden");colorPanel.classList.add("hidden");crosshair.classList.add("hidden")}
function beginGame(){gameActive=true;menu.classList.add("hidden");hud.classList.remove("hidden");crosshair.classList.remove("hidden");syncPlayers(players);updatePanels();canvas.requestPointerLock?.();const me=players.find(p=>p.id===myId);toast(me?.role==="hunter"?"당신은 술래 — 30초 동안 대기하세요":"30초 안에 색을 고르고 숨으세요")}
function showResult(title,text){gameActive=false;document.exitPointerLock?.();menu.classList.remove("hidden");menuDescription.classList.remove("hidden");lobby.classList.add("hidden");mainActions.classList.add("hidden");joinForm.classList.add("hidden");menuDescription.innerHTML=`<b>${title}</b><br>${text}<br><small>잠시 후 대기실로 돌아갑니다.</small>`;statusText.textContent=""}
function updatePanels(){const me=players.find(p=>p.id===myId);colorPanel.classList.toggle("hidden",!(me?.role==="hider"&&phase==="prepare"));phaseLabel.textContent=phase==="prepare"?"준비 시간":"추격 시간";roleLabel.textContent=me?.role==="hunter"?"술래 팀":"숨는 팀"}
function updateHud(){const h=players.filter(p=>p.role==="hider"),alive=h.filter(p=>!p.found);timer.textContent=`${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(Math.ceil(remaining%60)).padStart(2,"0")}`;survivors.textContent=`${alive.length} / ${h.length}`;updatePanels()}
function safe(v){const d=document.createElement("div");d.textContent=v;return d.innerHTML}
function toast(text){const t=$("#toast");t.textContent=text;t.classList.remove("hidden","show");void t.offsetWidth;t.classList.add("show");setTimeout(()=>t.classList.add("hidden"),2100)}

const paletteColors=["#ef4444","#f97316","#facc15","#4ade80","#38bdf8","#3b82f6","#8b5cf6","#ec4899","#e5e7eb","#64748b","#8b6b4a","#365c40","#b96558","#d0b84e"];
function pickColor(color){colorInput.value=color;hexOutput.value=color.toUpperCase();document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("active",b.dataset.color===color));wsSend({type:"color",color})}
function sampleSurfaceColor(){
  if(!gameActive)return;const me=players.find(p=>p.id===myId);if(me?.role!=="hider"||phase!=="prepare")return toast("색 복사는 준비 시간에만 가능합니다");
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObjects(map.children,true)[0];
  const surface=hit?.object?.material?.color;if(!surface)return toast("복사할 표면을 조준하세요");
  const color=`#${surface.getHexString()}`;pickColor(color);toast(`${color.toUpperCase()} 색상 복사 완료`);
}
paletteColors.forEach(c=>{const b=document.createElement("button");b.className="swatch";b.dataset.color=c;b.style.background=c;b.title=c;b.onclick=()=>pickColor(c);palette.appendChild(b)});colorInput.oninput=e=>pickColor(e.target.value);
sampleButton.onclick=sampleSurfaceColor;

$("#createButton").onclick=()=>{mainActions.classList.add("hidden");joinForm.classList.remove("hidden");roomInput.classList.add("hidden");joinButton.textContent="새 방 만들기 →";joinButton.dataset.mode="create"};
$("#showJoinButton").onclick=()=>{mainActions.classList.add("hidden");joinForm.classList.remove("hidden");roomInput.classList.remove("hidden");joinButton.textContent="입장하기 →";joinButton.dataset.mode="join"};
$("#backButton").onclick=()=>{joinForm.classList.add("hidden");mainActions.classList.remove("hidden");statusText.textContent=""};
$("#joinButton").onclick=()=>connect({type:joinButton.dataset.mode||"join",name:nameInput.value,code:roomInput.value.trim().toUpperCase()});
startButton.onclick=()=>wsSend({type:"start"});roomCode.onclick=()=>{navigator.clipboard?.writeText(currentRoom);toast("방 코드 복사됨")};

addEventListener("keydown",e=>{keys.add(e.code);if(e.code==="KeyE"&&!e.repeat)sampleSurfaceColor()});addEventListener("keyup",e=>keys.delete(e.code));addEventListener("blur",()=>keys.clear());
addEventListener("mousemove",e=>{if(document.pointerLockElement!==canvas||!gameActive)return;yaw-=e.movementX*.0023;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0018,-.15,.85)});
canvas.addEventListener("click",()=>{if(!gameActive)return;if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return}const me=players.find(p=>p.id===myId);if(me?.role!=="hunter"||phase!=="hunt")return;raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hits=raycaster.intersectObjects([...playerMeshes.values()],true);const hit=hits.find(h=>h.object.userData.playerId&&h.object.userData.playerId!==myId);if(hit)wsSend({type:"attack",targetId:hit.object.userData.playerId})});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

const clock=new THREE.Clock();
function animate(now){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);for(const m of playerMeshes.values()){if(m.userData.target)m.position.lerp(m.userData.target,Math.min(1,dt*14));m.rotation.y=m.userData.player?.yaw||0}
  const mine=playerMeshes.get(myId);if(mine){const target=mine.position.clone().add(new THREE.Vector3(0,1.25,0));const dist=5.8,offset=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch)*dist,2.1+Math.sin(pitch)*dist,-Math.cos(yaw)*Math.cos(pitch)*dist);camera.position.lerp(target.clone().add(offset),Math.min(1,dt*12));camera.lookAt(target);mine.visible=true}
  else{camera.position.set(16,18,25);camera.lookAt(0,0,0)}
  if(gameActive&&now-lastSend>45){lastSend=now;wsSend({type:"input",forward:keys.has("KeyW"),back:keys.has("KeyS"),left:keys.has("KeyA"),right:keys.has("KeyD"),run:keys.has("ShiftLeft")||keys.has("ShiftRight"),yaw})}
  renderer.render(scene,camera)}
requestAnimationFrame(animate);
