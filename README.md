# COLOR HIDE

주변 색에 맞춰 몸을 칠하고 숨는 독자적인 온라인 3D 숨바꼭질 MVP입니다.

**플레이:** https://meccha-chameleon-online.onrender.com

## MVP 기능

- Three.js 3D 맵과 3인칭 마우스 시점
- WASD 이동, Shift 달리기
- 팔레트 및 RGB 컬러 피커로 캐릭터 색 변경
- 방 생성 및 5자리 코드 입장, 최대 8명
- 30초 준비 시간과 3분 추격 시간
- 숨는 팀 / 술래 팀 무작위 배정
- 위치, 색상, 역할, 발견 상태 실시간 동기화
- 술래의 화면 중앙 클릭 발견 판정

## 로컬 실행

Node.js 20 이상에서 실행합니다.

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다. 온라인 테스트는 브라우저 창을 두 개 이상 열어 같은 방에 접속합니다.

## Render

`render.yaml`은 Node Web Service를 정의합니다. 서버 한 개가 정적 Three.js 클라이언트와 WebSocket 게임 서버를 함께 제공합니다.

PostgreSQL은 현재 필요하지 않습니다. 계정, 영구 전적, 리더보드를 추가할 때 도입할 수 있습니다.
