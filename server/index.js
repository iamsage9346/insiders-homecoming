import express from 'express'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Server } from 'socket.io'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const MC_PASSWORD = process.env.MC_PASSWORD || 'mc1234'

// ─────────────────────────────────────────────────────────────
// 질문 콘텐츠 (서버가 단일 소스 — 클라이언트로 브로드캐스트)
// ─────────────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 1, text: '인생에서 더 중요한 것은?', optionA: '연애', optionB: '창업' },
  {
    id: 2,
    text: '둘 중 하나만 선택 가능하다면?',
    optionA: '5,000억 가진 백수 (평생 수익활동 금지)',
    optionB: '돈 없는 CEO (창업·사업 가능)',
  },
  { id: 3, text: '평생 하나만 선택 가능하다면?', optionA: '아이디어 천재', optionB: '실행력 천재' },
  { id: 4, text: '창업할 때 더 중요한 것은?', optionA: '압도적인 팀', optionB: '압도적인 아이템' },
  { id: 5, text: '평생 하나만 가능하다면?', optionA: '좋아하는 사람과 결혼', optionB: '좋아하는 일 하며 살기' },
]

// ─────────────────────────────────────────────────────────────
// 인메모리 게임 상태 (행사용 단일 세션, 서버 재시작 시 초기화)
// ─────────────────────────────────────────────────────────────
const game = {
  phase: 'LOBBY', // LOBBY | FIRST_VOTE | REP_SELECT | FINAL_VOTE | RESULT | ENDED
  questionIndex: 0,
  firstOpen: false, // 1차 투표 열림 여부
  finalOpen: false, // 최종 투표 열림 여부
  reps: null, // { A: name|null, B: name|null }
  results: null, // showResult 시 집계 스냅샷
}

// id -> { id, name, firstVote, finalVote, socketId, connected }
const participants = new Map()
const socketToParticipant = new Map() // socket.id -> participant id

function currentQuestion() {
  return QUESTIONS[game.questionIndex] || null
}

function connectedCount() {
  let n = 0
  for (const p of participants.values()) if (p.connected) n++
  return n
}

function tally() {
  const first = { A: 0, B: 0 }
  const final = { A: 0, B: 0 }
  for (const p of participants.values()) {
    if (p.firstVote) first[p.firstVote]++
    if (p.finalVote) final[p.finalVote]++
  }
  return { first, final }
}

function computeResults() {
  const { first, final } = tally()
  let changed = 0
  let finalTotal = 0
  for (const p of participants.values()) {
    if (p.finalVote) finalTotal++
    if (p.firstVote && p.finalVote && p.firstVote !== p.finalVote) changed++
  }
  return { first, final, changed, total: finalTotal }
}

function resetVotes() {
  for (const p of participants.values()) {
    p.firstVote = null
    p.finalVote = null
  }
  game.reps = null
  game.results = null
}

// 모든 클라이언트가 화면을 그릴 수 있는 전역 상태 (개인 투표값은 제외)
function publicState() {
  return {
    phase: game.phase,
    questionIndex: game.questionIndex,
    totalQuestions: QUESTIONS.length,
    question: currentQuestion(),
    firstOpen: game.firstOpen,
    finalOpen: game.finalOpen,
    reps: game.reps,
    results: game.phase === 'RESULT' ? game.results : null,
    count: connectedCount(),
  }
}

let io // 아래에서 할당

function broadcastState() {
  io.emit('state', publicState())
}

function broadcastTally() {
  // 실시간 집계는 MC에게만 (참가자 화면 스포일러 방지)
  io.to('mc').emit('mc:tally', { ...tally(), count: connectedCount() })
}

// ─────────────────────────────────────────────────────────────
// MC 액션 핸들러 (상태 전이)
// ─────────────────────────────────────────────────────────────
function handleMcAction(type) {
  switch (type) {
    case 'start': // LOBBY -> 1차 투표 시작
      game.questionIndex = 0
      resetVotes()
      game.phase = 'FIRST_VOTE'
      game.firstOpen = true
      game.finalOpen = false
      break
    case 'lockFirst': // 1차 투표 마감 (잠금)
      game.firstOpen = false
      break
    case 'pickReps': { // 진영별 대표 랜덤 추출
      const poolA = []
      const poolB = []
      for (const p of participants.values()) {
        if (p.firstVote === 'A') poolA.push(p.name)
        if (p.firstVote === 'B') poolB.push(p.name)
      }
      game.reps = {
        A: poolA.length ? poolA[Math.floor(Math.random() * poolA.length)] : null,
        B: poolB.length ? poolB[Math.floor(Math.random() * poolB.length)] : null,
      }
      game.firstOpen = false
      game.phase = 'REP_SELECT'
      break
    }
    case 'startFinal': // 최종(재)투표 시작
      game.finalOpen = true
      game.phase = 'FINAL_VOTE'
      break
    case 'showResult': // 최종 투표 마감 + 결과 집계
      game.finalOpen = false
      game.results = computeResults()
      game.phase = 'RESULT'
      break
    case 'reset': // 전체 초기화: 참가자·투표 전부 삭제 후 대기실로
      participants.clear()
      socketToParticipant.clear()
      game.phase = 'LOBBY'
      game.questionIndex = 0
      game.firstOpen = false
      game.finalOpen = false
      game.reps = null
      game.results = null
      io.emit('reset') // 참가자 클라이언트가 로컬 세션을 비우고 입장 화면으로
      break
    case 'next': // 다음 질문 또는 종료
      if (game.questionIndex + 1 < QUESTIONS.length) {
        game.questionIndex++
        resetVotes()
        game.phase = 'FIRST_VOTE'
        game.firstOpen = true
        game.finalOpen = false
      } else {
        game.phase = 'ENDED'
        game.firstOpen = false
        game.finalOpen = false
      }
      break
    default:
      return
  }
  broadcastState()
  broadcastTally()
}

// ─────────────────────────────────────────────────────────────
// HTTP + Socket.io
// ─────────────────────────────────────────────────────────────
const app = express()
const httpServer = createServer(app)
io = new Server(httpServer, {
  cors: { origin: true }, // dev: vite(5173) → server(3000) 허용
})

io.on('connection', (socket) => {
  // 즉시 현재 상태 전송 (대기실/투표 화면 복구)
  socket.emit('state', publicState())

  // 참가자 입장 / 재접속 복구
  socket.on('participant:join', ({ id, name }) => {
    const cleanName = String(name || '').trim()
    if (!cleanName) return // 빈 값 차단

    let pid = id && participants.has(id) ? id : null
    if (!pid) {
      pid = randomUUID()
      participants.set(pid, {
        id: pid,
        name: cleanName,
        firstVote: null,
        finalVote: null,
        socketId: socket.id,
        connected: true,
      })
    } else {
      const p = participants.get(pid)
      p.name = cleanName // 이름 갱신 허용
      p.socketId = socket.id
      p.connected = true
    }
    socketToParticipant.set(socket.id, pid)

    const p = participants.get(pid)
    socket.emit('joined', { id: pid, name: p.name })
    socket.emit('you', { firstVote: p.firstVote, finalVote: p.finalVote })
    broadcastState()
    broadcastTally()
  })

  // 투표 (1차/최종)
  socket.on('vote:cast', ({ choice, round }) => {
    const pid = socketToParticipant.get(socket.id)
    if (!pid) return
    const p = participants.get(pid)
    if (!p || (choice !== 'A' && choice !== 'B')) return

    if (round === 'first' && game.firstOpen) {
      p.firstVote = choice
    } else if (round === 'final' && game.finalOpen) {
      p.finalVote = choice
    } else {
      return // 마감 후 / 잘못된 라운드 → 차단
    }
    socket.emit('you', { firstVote: p.firstVote, finalVote: p.finalVote })
    broadcastTally()
  })

  // MC 인증
  socket.on('mc:hello', ({ password }, ack) => {
    const ok = password === MC_PASSWORD
    if (ok) {
      socket.data.isMC = true
      socket.join('mc')
      socket.emit('state', publicState())
      socket.emit('mc:tally', { ...tally(), count: connectedCount() })
    }
    if (typeof ack === 'function') ack({ ok })
  })

  // MC 액션 (서버에서 권한 검증)
  socket.on('mc:action', ({ type }) => {
    if (!socket.data.isMC) return
    handleMcAction(type)
  })

  socket.on('disconnect', () => {
    const pid = socketToParticipant.get(socket.id)
    if (pid) {
      const p = participants.get(pid)
      // 같은 socket이 아직 등록된 현재 소켓일 때만 연결 해제 처리(새로고침 경합 방지)
      if (p && p.socketId === socket.id) p.connected = false
      socketToParticipant.delete(socket.id)
      broadcastState()
      broadcastTally()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 정적 파일 서빙 (빌드된 프론트엔드) + SPA fallback
// ─────────────────────────────────────────────────────────────
const distDir = path.join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

httpServer.listen(PORT, () => {
  console.log(`\n🎤 죽음의 밸런스 토론 배틀 서버 실행 중`)
  console.log(`   참가자:  http://localhost:${PORT}/`)
  console.log(`   사회자:  http://localhost:${PORT}/mc   (비밀번호: ${MC_PASSWORD})`)
  console.log(`   * MC_PASSWORD 환경변수로 비밀번호 변경 가능\n`)
})
