import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { socket } from './lib/socket.js'
import ResultChart from './ResultChart.jsx'

const PHASE_LABEL = {
  LOBBY: '대기실',
  FIRST_VOTE: '1차 투표',
  REP_SELECT: '대표 발표 / 토론',
  FINAL_VOTE: '최종 투표',
  RESULT: '결과 공개',
  ENDED: '게임 종료',
}

export default function MC() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [gameState, setGameState] = useState(null)
  const [tally, setTally] = useState({ first: { A: 0, B: 0 }, final: { A: 0, B: 0 }, count: 0 })
  const [confirmReset, setConfirmReset] = useState(false)
  const pwRef = useRef('')

  useEffect(() => {
    function onState(s) {
      setGameState(s)
    }
    function onTally(t) {
      setTally(t)
    }
    function onConnect() {
      // 재연결 시 자동 재인증
      if (pwRef.current) socket.emit('mc:hello', { password: pwRef.current }, () => {})
    }
    socket.on('state', onState)
    socket.on('mc:tally', onTally)
    socket.on('connect', onConnect)
    return () => {
      socket.off('state', onState)
      socket.off('mc:tally', onTally)
      socket.off('connect', onConnect)
    }
  }, [])

  function login(e) {
    e.preventDefault()
    socket.emit('mc:hello', { password: pw }, (res) => {
      if (res?.ok) {
        pwRef.current = pw
        setAuthed(true)
        setErr('')
      } else {
        setErr('비밀번호가 틀렸습니다')
      }
    })
  }

  function action(type) {
    socket.emit('mc:action', { type })
  }

  // ── 인증 화면 ───────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6">
        <h1 className="text-3xl font-extrabold mb-6">🎤 사회자 콘솔</h1>
        <form onSubmit={login} className="w-full max-w-sm">
          <input
            autoFocus
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="사회자 비밀번호"
            className="w-full px-5 py-4 rounded-2xl bg-slate-800 text-xl text-center outline-none focus:ring-2 focus:ring-rose-500"
          />
          {err && <p className="text-rose-400 text-center mt-3">{err}</p>}
          <button className="mt-4 w-full py-4 rounded-2xl bg-rose-500 text-xl font-bold active:scale-95 transition">
            입장
          </button>
        </form>
      </div>
    )
  }

  if (!gameState) return <div className="p-10 text-2xl">연결 중...</div>

  const { phase, question, questionIndex, totalQuestions, firstOpen, finalOpen, reps, results, count } =
    gameState
  const isLast = questionIndex + 1 >= totalQuestions

  // 현재 단계에서 가능한 다음 액션
  let actions = []
  if (phase === 'LOBBY') actions = [{ type: 'start', label: '▶ 게임 시작' }]
  else if (phase === 'FIRST_VOTE' && firstOpen) actions = [{ type: 'lockFirst', label: '🔒 1차 투표 마감' }]
  else if (phase === 'FIRST_VOTE') actions = [{ type: 'pickReps', label: '🎲 대표 랜덤 뽑기' }]
  else if (phase === 'REP_SELECT') actions = [{ type: 'startFinal', label: '🔥 최종 투표 시작' }]
  else if (phase === 'FINAL_VOTE') actions = [{ type: 'showResult', label: '📊 결과 보기' }]
  else if (phase === 'RESULT')
    actions = [{ type: 'next', label: isLast ? '🏁 게임 종료' : '➡ 다음 질문으로' }]

  const participantUrl = window.location.origin + '/'

  return (
    <div className="min-h-full flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-8 py-4 bg-slate-800/60">
        <div>
          <div className="text-rose-400 font-bold text-lg">{PHASE_LABEL[phase]}</div>
          {phase !== 'LOBBY' && phase !== 'ENDED' && (
            <div className="text-slate-400 text-sm">
              질문 {questionIndex + 1} / {totalQuestions}
            </div>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-4xl font-extrabold">{count}</div>
            <div className="text-slate-400 text-sm">접속 인원</div>
          </div>
          {confirmReset ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-amber-400">참가자·투표 모두 삭제할까요?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    action('reset')
                    setConfirmReset(false)
                  }}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-bold"
                >
                  예, 초기화
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="px-3 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700"
            >
              🔄 전체 초기화
            </button>
          )}
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-6 text-center">
        {phase === 'LOBBY' && (
          <div className="flex flex-col items-center">
            <h1 className="text-5xl font-extrabold mb-2">죽음의 밸런스 토론 배틀</h1>
            <p className="text-slate-400 text-xl mb-8">아래 QR로 접속하세요</p>
            <div className="bg-white p-6 rounded-3xl">
              <QRCodeCanvas value={participantUrl} size={240} />
            </div>
            <p className="mt-4 text-slate-300 text-lg break-all">{participantUrl}</p>
          </div>
        )}

        {(phase === 'FIRST_VOTE' || phase === 'FINAL_VOTE') && question && (
          <div className="w-full max-w-4xl">
            <h1 className="text-5xl font-extrabold mb-10 leading-tight">{question.text}</h1>
            <LiveTally
              question={question}
              counts={phase === 'FIRST_VOTE' ? tally.first : tally.final}
            />
            <p className="mt-6 text-slate-400 text-xl">
              {(phase === 'FIRST_VOTE' ? firstOpen : finalOpen)
                ? '투표 진행 중...'
                : '투표 마감됨'}
            </p>
          </div>
        )}

        {phase === 'REP_SELECT' && question && (
          <div className="w-full max-w-4xl">
            <h1 className="text-4xl font-extrabold mb-10">{question.text}</h1>
            <div className="flex gap-6 justify-center">
              <RepCard label={question.optionA} name={reps?.A} color="sky" />
              <RepCard label={question.optionB} name={reps?.B} color="rose" />
            </div>
            <p className="mt-10 text-slate-400 text-2xl">🎙️ 대표 토론을 진행하세요</p>
          </div>
        )}

        {phase === 'RESULT' && question && (
          <div className="w-full max-w-4xl">
            <h1 className="text-4xl font-extrabold mb-2">{question.text}</h1>
            <p className="text-slate-400 text-xl mb-6">1차 vs 최종 투표 비교</p>
            <ResultChart question={question} results={results} big />
          </div>
        )}

        {phase === 'ENDED' && (
          <div>
            <div className="text-7xl mb-6">🎉</div>
            <h1 className="text-5xl font-extrabold">모든 라운드 종료!</h1>
            <p className="text-slate-400 text-2xl mt-4">수고하셨습니다</p>
          </div>
        )}
      </main>

      {/* 컨트롤 바 */}
      <footer className="px-8 py-6 bg-slate-800/60 flex justify-center gap-4">
        {actions.length === 0 ? (
          <span className="text-slate-500 text-xl py-4">제어할 액션이 없습니다</span>
        ) : (
          actions.map((a) => (
            <button
              key={a.type}
              onClick={() => action(a.type)}
              className="px-12 py-6 rounded-2xl bg-rose-500 hover:bg-rose-400 text-3xl font-extrabold active:scale-95 transition"
            >
              {a.label}
            </button>
          ))
        )}
      </footer>
    </div>
  )
}

// ── 보조 컴포넌트 ─────────────────────────────────────────
function LiveTally({ question, counts }) {
  const total = counts.A + counts.B
  const pctA = total ? Math.round((counts.A / total) * 100) : 0
  const pctB = total ? 100 - pctA : 0
  return (
    <div className="flex gap-6">
      <TallyBar label={question.optionA} count={counts.A} pct={pctA} color="bg-sky-500" />
      <TallyBar label={question.optionB} count={counts.B} pct={pctB} color="bg-rose-500" />
    </div>
  )
}

function TallyBar({ label, count, pct, color }) {
  return (
    <div className="flex-1 bg-slate-800 rounded-3xl p-6">
      <div className="text-2xl font-bold mb-2">{label}</div>
      <div className="text-6xl font-extrabold mb-3">{count}</div>
      <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-slate-400 mt-2 text-xl">{pct}%</div>
    </div>
  )
}

function RepCard({ label, name, color }) {
  const accent = color === 'sky' ? 'text-sky-400' : 'text-rose-400'
  return (
    <div className="flex-1 bg-slate-800 rounded-3xl p-10">
      <div className="text-slate-400 text-2xl mb-4">{label}</div>
      <div className={`text-5xl font-extrabold ${accent}`}>{name || '대표 없음'}</div>
    </div>
  )
}
