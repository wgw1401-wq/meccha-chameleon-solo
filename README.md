# 멧차 카멜레온

배경색에 위장해 AI 술래를 피하는 1인용 Canvas 웹게임입니다.

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

## Render 배포

1. 이 폴더를 GitHub 저장소에 푸시합니다.
2. Render Dashboard에서 **New > Blueprint**를 선택합니다.
3. 저장소를 연결하면 `render.yaml` 설정으로 Static Site가 생성됩니다.

별도 서버나 환경 변수 없이 `public` 폴더가 그대로 배포됩니다.
