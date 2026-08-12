# 멧차 카멜레온

배경색에 위장해 AI 또는 사람 술래를 피하는 Canvas 웹게임입니다.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/wgw1401-wq/meccha-chameleon-solo)

**플레이:** https://meccha-chameleon-online.onrender.com

## 로컬 실행

Node.js 20 이상에서 다음 명령을 실행할 수 있습니다.

```bash
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 조작법

- `WASD` 또는 방향키: 이동
- `Space`: 현재 색 구역에 위장
- `Shift`: 대시

## 온라인 플레이

- **온라인 플레이**에서 닉네임을 입력하고 방을 만듭니다.
- 친구가 같은 주소에서 5자리 방 코드로 참가합니다.
- 2~6명이 참가할 수 있으며 방장이 시작하면 술래 한 명이 무작위로 정해집니다.
- 술래가 제한 시간 안에 모든 카멜레온과 닿으면 승리합니다.

## Render 배포

1. 이 폴더를 GitHub 저장소에 푸시합니다.
2. Render Dashboard에서 **New > Blueprint**를 선택합니다.
3. 저장소를 연결하면 `render.yaml` 설정으로 Web Service가 생성됩니다.

또는 위의 **Deploy to Render** 버튼을 눌러 바로 생성할 수 있습니다.

Node 서버가 정적 게임 파일과 실시간 WebSocket 방을 함께 제공합니다.
