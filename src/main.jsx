import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import Participant from './Participant.jsx'
import MC from './MC.jsx'

// 간단 라우팅: /mc → 사회자, 그 외 → 참가자
const isMC = window.location.pathname.replace(/\/$/, '') === '/mc'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isMC ? <MC /> : <Participant />}</React.StrictMode>,
)
