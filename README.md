# 죽음의 밸런스 토론 배틀 🎤

홈커밍데이용 실시간 밸런스 게임 웹앱. 사회자가 버튼으로 흐름을 제어하고, 참가자는 모바일로 접속해 실시간 투표한다.

- **스택**: React(Vite) + Tailwind + Recharts / Node + Express + Socket.io / 인메모리(단일 세션)
- **단일 서버**가 빌드된 프론트엔드와 실시간 소켓을 함께 서빙한다.

## 로컬 실행

```bash
npm install
npm run build      # 프론트엔드 빌드 → dist/
npm start          # http://localhost:3000
```

- 참가자: `http://localhost:3000/`
- 사회자: `http://localhost:3000/mc` (기본 비밀번호 `mc1234`)

비밀번호 변경: `MC_PASSWORD=원하는값 npm start`

### 현장에서 외부 접속 (로컬 + ngrok)

```bash
npm start                 # 한 터미널
npx ngrok http 3000       # 다른 터미널 → 발급된 https URL 사용
```

사회자 화면(`/mc`)의 QR을 대형 화면에 띄우면 참가자가 그 자리에서 접속한다.

## 개발 모드 (핫리로드)

```bash
npm run dev   # vite(5173) + 소켓 서버(3000) 동시 실행
```

개발 중에는 `http://localhost:5173/` 로 접속한다.

## 배포 (Railway / Render)

1. 이 레포를 연결
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. 환경변수 `MC_PASSWORD` 설정 (선택), `PORT`는 플랫폼이 자동 주입

## 게임 흐름 (사회자 버튼)

대기실 → **게임 시작** → 1차 투표 → **1차 투표 마감** → **대표 랜덤 뽑기** →
대표 토론 → **최종 투표 시작** → **결과 보기**(1차 vs 최종 비교) → **다음 질문으로** … 5라운드 반복 후 종료

## 메모

- 서버 재시작 시 모든 상태(참가자·투표)가 초기화된다(인메모리, 의도된 설계).
- 새로고침/네트워크 끊김 시 `localStorage`의 참가자 ID로 자동 복구된다.
- 질문 5개는 `server/index.js` 상단 `QUESTIONS` 배열에서 수정한다(서버가 단일 소스).
