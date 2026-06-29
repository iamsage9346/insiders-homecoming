import { useEffect, useRef, useState } from 'react'
import { socket } from './lib/socket.js'
import ResultChart from './ResultChart.jsx'

export default function Participant() {
  const [gameState, setGameState] = useState(null)
  const [myVotes, setMyVotes] = useState({ firstVote: null, finalVote: null })
  const [joined, setJoined] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [connected, setConnected] = useState(socket.connected)

  const idRef = useRef(localStorage.getItem('balanceId') || null)
  const nameRef = useRef(localStorage.getItem('balanceName') || '')
  const lastQ = useRef(null)

  useEffect(() => {
    function rejoin() {
      if (nameRef.current) {
        socket.emit('participant:join', { id: idRef.current, name: nameRef.current })
      }
    }
    function onConnect() {
      setConnected(true)
      rejoin()
    }
    function onDisconnect() {
      setConnected(false)
    }
    function onState(s) {
      setGameState(s)
      // 새 질문으로 넘어가면 로컬 투표 표시 초기화
      if (lastQ.current !== null && lastQ.current !== s.questionIndex) {
        setMyVotes({ firstVote: null, finalVote: null })
      }
      lastQ.current = s.questionIndex
    }
    function onYou(v) {
      setMyVotes(v)
    }
    function onJoined({ id, name }) {
      idRef.current = id
      nameRef.current = name
      localStorage.setItem('balanceId', id)
      localStorage.setItem('balanceName', name)
      setJoined(true)
    }
    function onReset() {
      // 사회자가 전체 초기화 → 로컬 세션 비우고 입장 화면으로 복귀
      localStorage.removeItem('balanceId')
      localStorage.removeItem('balanceName')
      idRef.current = null
      nameRef.current = ''
      lastQ.current = null
      setMyVotes({ firstVote: null, finalVote: null })
      setNameInput('')
      setJoined(false)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('state', onState)
    socket.on('you', onYou)
    socket.on('joined', onJoined)
    socket.on('reset', onReset)
    if (socket.connected) rejoin()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('state', onState)
      socket.off('you', onYou)
      socket.off('joined', onJoined)
      socket.off('reset', onReset)
    }
  }, [])

  function submitName(e) {
    e.preventDefault()
    const n = nameInput.trim()
    if (!n) return
    nameRef.current = n
    socket.emit('participant:join', { id: idRef.current, name: n })
  }

  function cast(choice, round) {
    socket.emit('vote:cast', { choice, round })
  }

  // ── 연결 전 ──────────────────────────────────────────────
  if (!gameState) {
    return <Center>연결 중...</Center>
  }

  // ── 입장(이름 등록) ─────────────────────────────────────
  if (!joined) {
    return (
      <Center>
        <h1 className="text-3xl font-extrabold mb-2">죽음의 밸런스</h1>
        <p className="text-slate-400 mb-8">토론 배틀에 참여하세요</p>
        <form onSubmit={submitName} className="w-full max-w-sm">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="예: 29기 박상화"
            className="w-full px-5 py-4 rounded-2xl bg-slate-800 text-xl text-center outline-none ring-2 ring-transparent focus:ring-rose-500"
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="mt-4 w-full py-4 rounded-2xl bg-rose-500 text-xl font-bold disabled:opacity-40 active:scale-95 transition"
          >
            입장하기
          </button>
        </form>
      </Center>
    )
  }

  const { phase, question, firstOpen, finalOpen, reps, results, count } = gameState

  // ── 단계별 화면 ─────────────────────────────────────────
  let body
  if (phase === 'LOBBY') {
    body = (
      <Center>
        <Badge>{nameRef.current}</Badge>
        <div className="text-6xl mb-6">⏳</div>
        <h2 className="text-2xl font-bold mb-2">게임 시작 대기 중...</h2>
        <p className="text-slate-400">현재 {count}명 접속</p>
      </Center>
    )
  } else if (phase === 'FIRST_VOTE' && firstOpen) {
    body = (
      <VoteScreen
        question={question}
        selected={myVotes.firstVote}
        onPick={(c) => cast(c, 'first')}
        label="1차 선택 — 마감 전까지 변경 가능"
      />
    )
  } else if (phase === 'FINAL_VOTE' && finalOpen) {
    body = (
      <VoteScreen
        question={question}
        selected={myVotes.finalVote}
        onPick={(c) => cast(c, 'final')}
        label="🔥 최종 투표 — 마음을 바꿔도 됩니다"
        accent
      />
    )
  } else if (phase === 'REP_SELECT') {
    body = (
      <Center>
        <Badge>{nameRef.current}</Badge>
        <h2 className="text-xl text-slate-300 mb-6">선발된 대표</h2>
        <RepRow label={question.optionA} name={reps?.A} color="text-sky-400" />
        <RepRow label={question.optionB} name={reps?.B} color="text-rose-400" />
        <p className="mt-8 text-slate-400">토론을 지켜봐 주세요 👀</p>
      </Center>
    )
  } else if (phase === 'RESULT') {
    body = (
      <div className="px-5 py-8 max-w-md mx-auto w-full">
        <Badge>{nameRef.current}</Badge>
        <h2 className="text-lg text-slate-300 mb-1 text-center">{question.text}</h2>
        <p className="text-center text-sm text-slate-500 mb-4">1차 vs 최종 결과</p>
        <ResultChart question={question} results={results} />
      </div>
    )
  } else if (phase === 'ENDED') {
    body = (
      <Center>
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold">모든 라운드 종료!</h2>
        <p className="text-slate-400 mt-2">함께해 주셔서 감사합니다</p>
      </Center>
    )
  } else {
    // FIRST_VOTE 마감 후 / FINAL_VOTE 마감 후 등 잠금 대기
    body = (
      <Center>
        <Badge>{nameRef.current}</Badge>
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-2xl font-bold mb-2">투표 마감</h2>
        <p className="text-slate-400">잠시 기다려주세요</p>
      </Center>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      {!connected && (
        <div className="bg-amber-600 text-center text-sm py-1">재연결 중...</div>
      )}
      <div className="flex-1 flex flex-col">{body}</div>
    </div>
  )
}

// ── 작은 컴포넌트들 ────────────────────────────────────────
function Center({ children }) {
  return (
    <div className="min-h-full flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
      {children}
    </div>
  )
}

function Badge({ children }) {
  return (
    <div className="mb-6 inline-block px-3 py-1 rounded-full bg-slate-800 text-sm text-slate-300">
      {children}
    </div>
  )
}

function VoteScreen({ question, selected, onPick, label, accent }) {
  return (
    <div className="flex-1 flex flex-col px-5 py-8 max-w-md mx-auto w-full">
      <p className={`text-center text-sm mb-2 ${accent ? 'text-rose-400' : 'text-slate-400'}`}>
        {label}
      </p>
      <h2 className="text-center text-2xl font-extrabold mb-8 leading-snug">{question.text}</h2>
      <div className="flex-1 flex flex-col gap-4 justify-center">
        <OptionButton
          letter="A"
          text={question.optionA}
          active={selected === 'A'}
          color="sky"
          onClick={() => onPick('A')}
        />
        <div className="text-center text-slate-500 font-bold">VS</div>
        <OptionButton
          letter="B"
          text={question.optionB}
          active={selected === 'B'}
          color="rose"
          onClick={() => onPick('B')}
        />
      </div>
      {selected && (
        <p className="text-center text-slate-400 mt-6 text-sm">
          ✅ <b className="text-white">{selected}</b> 선택됨
        </p>
      )}
    </div>
  )
}

function OptionButton({ letter, text, active, color, onClick }) {
  const ring = color === 'sky' ? 'ring-sky-400' : 'ring-rose-400'
  const bg = active
    ? color === 'sky'
      ? 'bg-sky-500'
      : 'bg-rose-500'
    : 'bg-slate-800'
  return (
    <button
      onClick={onClick}
      className={`w-full py-8 rounded-3xl ${bg} ${
        active ? `ring-4 ${ring}` : ''
      } transition active:scale-95 flex flex-col items-center`}
    >
      <span className="text-sm opacity-70 mb-1">{letter}</span>
      <span className="text-2xl font-extrabold px-4 leading-tight">{text}</span>
    </button>
  )
}

function RepRow({ label, name, color }) {
  return (
    <div className="w-full max-w-sm bg-slate-800 rounded-2xl px-5 py-4 mb-3 flex items-center justify-between">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{name || '대표 없음'}</span>
    </div>
  )
}
