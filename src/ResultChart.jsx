import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  CartesianGrid,
} from 'recharts'

// 1차 vs 최종 비교 차트 + 변화량 강조
export default function ResultChart({ question, results, big = false }) {
  if (!question || !results) return null
  const { first, final, changed } = results

  const data = [
    { name: question.optionA, '1차': first.A, 최종: final.A },
    { name: question.optionB, '1차': first.B, 최종: final.B },
  ]

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={big ? 380 : 240}>
        <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#e2e8f0', fontSize: big ? 18 : 13, fontWeight: 700 }}
            interval={0}
          />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: big ? 16 : 12 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
            cursor={{ fill: 'rgba(148,163,184,0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: big ? 18 : 14 }} />
          <Bar dataKey="1차" fill="#64748b" radius={[6, 6, 0, 0]}>
            <LabelList dataKey="1차" position="top" fill="#cbd5e1" fontSize={big ? 18 : 13} />
          </Bar>
          <Bar dataKey="최종" fill="#f43f5e" radius={[6, 6, 0, 0]}>
            <LabelList dataKey="최종" position="top" fill="#fda4af" fontSize={big ? 18 : 13} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div
        className={`mt-4 text-center font-extrabold ${
          big ? 'text-4xl' : 'text-2xl'
        } ${changed > 0 ? 'text-amber-400' : 'text-slate-400'}`}
      >
        {changed > 0 ? `💥 ${changed}명이 마음을 바꿨어요!` : '아무도 마음을 바꾸지 않았어요'}
      </div>
    </div>
  )
}
