'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  equipment: string | null
}

type SetRow = {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
  rpe: number | null
  is_warmup: boolean
  created_at: string
  exercise: Exercise | null
}

type SessionRow = {
  id: string
  user_id: string
  title: string
  notes: string | null
  session_date: string
  created_at: string
  workout_sets: SetRow[]
}

type DraftSet = {
  tempId: string
  exercise_id: string
  weight_kg: number
  reps: number
  rir: number
  is_warmup: boolean
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value + 'T00:00:00'))
}

function displayWeight(weight: number) {
  return weight === 0 ? 'BW' : `${weight} kg`
}

function estimatedOneRepMax(weight: number, reps: number) {
  if (weight <= 0) return 0
  return weight * (1 + reps / 30)
}

function makeTempId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function Home() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [search, setSearch] = useState('')

  const [sessionTitle, setSessionTitle] = useState('Workout')
  const [sessionDate, setSessionDate] = useState(todayIso())
  const [notes, setNotes] = useState('')

  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rir, setRir] = useState('2')
  const [isWarmup, setIsWarmup] = useState(false)
  const [draftSets, setDraftSets] = useState<DraftSet[]>([])
  const [showTimer, setShowTimer] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(90)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => {
    if (!timerRunning) return

    const timer = window.setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer)
          setTimerRunning(false)
          return 0
        }
        return seconds - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [timerRunning])

  const formatTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remaining = seconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
  }

  const setTimerPreset = (seconds: number) => {
    setTimerSeconds(seconds)
    setTimerRunning(true)
  }

  const fetchExercises = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id,name,muscle_group,equipment')
      .order('muscle_group')
      .order('name')

    if (error) throw error
    const rows = (data ?? []) as Exercise[]
    setExercises(rows)
    if (!exerciseId && rows[0]) setExerciseId(rows[0].id)
  }

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        id,
        user_id,
        title,
        notes,
        session_date,
        created_at,
        workout_sets (
          id,
          session_id,
          exercise_id,
          set_number,
          weight_kg,
          reps,
          rpe,
          is_warmup,
          created_at,
          exercise:exercises (
            id,
            name,
            muscle_group,
            equipment
          )
        )
      `)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const rows = (data ?? []) as unknown as SessionRow[]
    rows.forEach((session) => {
      session.workout_sets = [...(session.workout_sets ?? [])].sort(
        (a, b) => a.set_number - b.set_number,
      )
    })
    setSessions(rows)
  }

  useEffect(() => {
    const load = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!currentUser) {
        router.replace('/login')
        return
      }

      setUser(currentUser)

      try {
        await Promise.all([fetchExercises(), fetchSessions()])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown database error'
        alert(
          'V2 database chưa sẵn sàng. Hãy chạy file supabase/schema_v2.sql trong Supabase SQL Editor.\n\n' +
            message,
        )
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase])

  const selectedExercise = exercises.find((item) => item.id === exerciseId) ?? null

  const exerciseHistory = useMemo(() => {
    if (!exerciseId) return []

    return sessions
      .flatMap((session) =>
        session.workout_sets
          .filter((set) => set.exercise_id === exerciseId && !set.is_warmup)
          .map((set) => ({ ...set, sessionDate: session.session_date })),
      )
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
  }, [exerciseId, sessions])

  const exerciseStats = useMemo(() => {
    if (exerciseHistory.length === 0) {
      return {
        bestWeight: 0,
        bestReps: 0,
        bestE1rm: 0,
        chartPoints: [] as { date: string; value: number }[],
      }
    }

    const bestWeight = Math.max(...exerciseHistory.map((set) => Number(set.weight_kg)))
    const bestReps = Math.max(...exerciseHistory.map((set) => set.reps))
    const bestE1rm = Math.max(
      ...exerciseHistory.map((set) => estimatedOneRepMax(Number(set.weight_kg), set.reps)),
    )

    const byDate = new Map<string, number>()
    for (const set of exerciseHistory) {
      const e1rm = estimatedOneRepMax(Number(set.weight_kg), set.reps)
      const current = byDate.get(set.sessionDate) ?? 0
      if (e1rm > current) byDate.set(set.sessionDate, e1rm)
    }

    const chartPoints = [...byDate.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)

    return { bestWeight, bestReps, bestE1rm, chartPoints }
  }, [exerciseHistory])

  const chartPolyline = useMemo(() => {
    const points = exerciseStats.chartPoints
    if (points.length === 0) return ''

    const values = points.map((point) => point.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(max - min, 1)

    return points
      .map((point, index) => {
        const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100
        const y = 90 - ((point.value - min) / span) * 75
        return `${x},${y}`
      })
      .join(' ')
  }, [exerciseStats.chartPoints])

  const nextTarget = useMemo(() => {
    const last = exerciseHistory[0]

    if (!last || !selectedExercise) {
      return 'Chưa có working set trước đó. Ghi buổi đầu tiên để tạo baseline.'
    }

    const lastRir = last.rpe === null ? 2 : Math.max(0, Math.round(10 - last.rpe))

    if (last.reps >= 12 && lastRir >= 1) {
      if (last.weight_kg === 0) {
        return `Lần trước: BW × ${last.reps} @ RIR ${lastRir}. Nếu form sạch, thử thêm 2.5 kg và quay về 6–8 reps.`
      }
      return `Lần trước: ${last.weight_kg} kg × ${last.reps} @ RIR ${lastRir}. Thử ${last.weight_kg + 2.5} kg ở 6–8 reps.`
    }

    if (lastRir === 0) {
      return `Lần trước: ${displayWeight(last.weight_kg)} × ${last.reps} @ RIR 0. Giữ mức hiện tại, ưu tiên form và cố đạt lại reps với RIR ≥ 1.`
    }

    return `Lần trước: ${displayWeight(last.weight_kg)} × ${last.reps} @ RIR ${lastRir}. Target: cùng mức tạ × ${Math.min(last.reps + 1, 12)} reps.`
  }, [exerciseHistory, selectedExercise])

  const addDraftSet = () => {
    if (!exerciseId) return alert('Chọn bài tập trước.')

    const parsedWeight = Number(weight)
    const parsedReps = Number(reps)
    const parsedRir = Number(rir)

    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) return alert('Mức tạ không hợp lệ.')
    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 100) return alert('Reps không hợp lệ.')
    if (!Number.isInteger(parsedRir) || parsedRir < 0 || parsedRir > 4) return alert('RIR nên từ 0–4.')

    setDraftSets((current) => [
      ...current,
      {
        tempId: makeTempId(),
        exercise_id: exerciseId,
        weight_kg: parsedWeight,
        reps: parsedReps,
        rir: parsedRir,
        is_warmup: isWarmup,
      },
    ])
    setReps('')
  }

  const repeatLastSet = () => {
    const last = [...draftSets].reverse().find((set) => set.exercise_id === exerciseId)
    if (!last) return alert('Chưa có set nào của bài này để copy.')

    setWeight(String(last.weight_kg))
    setReps(String(last.reps))
    setRir(String(last.rir))
    setIsWarmup(last.is_warmup)
  }

  const removeDraftSet = (tempId: string) => {
    setDraftSets((current) => current.filter((set) => set.tempId !== tempId))
  }

  const saveSession = async () => {
    if (!user) return
    if (draftSets.length === 0) return alert('Thêm ít nhất một set trước khi lưu buổi tập.')

    setSaving(true)

    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        title: sessionTitle.trim() || 'Workout',
        notes: notes.trim() || null,
        session_date: sessionDate,
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      alert('Không tạo được buổi tập: ' + (sessionError?.message ?? 'Unknown error'))
      setSaving(false)
      return
    }

    const counters = new Map<string, number>()
    const rows = draftSets.map((set) => {
      const current = (counters.get(set.exercise_id) ?? 0) + 1
      counters.set(set.exercise_id, current)

      return {
        session_id: session.id,
        exercise_id: set.exercise_id,
        set_number: current,
        weight_kg: set.weight_kg,
        reps: set.reps,
        rpe: 10 - set.rir,
        is_warmup: set.is_warmup,
      }
    })

    const { error: setsError } = await supabase.from('workout_sets').insert(rows)

    if (setsError) {
      await supabase.from('workout_sessions').delete().eq('id', session.id)
      alert('Không lưu được sets: ' + setsError.message)
      setSaving(false)
      return
    }

    setDraftSets([])
    setNotes('')
    setSessionTitle('Workout')
    setSessionDate(todayIso())
    await fetchSessions()
    setSaving(false)
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Xóa buổi tập này? Tất cả sets bên trong cũng sẽ bị xóa.')) return

    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId)
    if (error) return alert(error.message)

    await fetchSessions()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const filteredSessions = sessions.filter((session) => {
    const haystack = [
      session.title,
      session.notes ?? '',
      ...session.workout_sets.map((set) => set.exercise?.name ?? ''),
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(search.toLowerCase())
  })

  const workingSets = sessions.flatMap((session) =>
    session.workout_sets.filter((set) => !set.is_warmup),
  )
  const totalVolume = workingSets.reduce(
    (sum, set) => sum + Number(set.weight_kg) * set.reps,
    0,
  )
  const maxLoadedWeight = workingSets.reduce(
    (max, set) => Math.max(max, Number(set.weight_kg)),
    0,
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] text-white flex items-center justify-center">
        Đang tải FitProgress...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#090d16] pb-20 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-lg shadow-lg shadow-emerald-500/20">
              🏋️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">FitProgress</h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">
                  Overload Tracker
                </span>
              </div>
              <p className="hidden text-xs text-slate-400 sm:block">
                Theo dõi tăng tiến tải trọng & thể tích tập luyện
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTimer(true)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              ⏱ {formatTimer(timerSeconds)}
            </button>
            <button
              onClick={() => window.scrollTo({ top: 250, behavior: 'smooth' })}
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
            >
              + Ghi buổi tập
            </button>
            <button
              onClick={handleLogout}
              className="hidden rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 sm:block"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Tổng buổi tập</p>
              <p className="mt-1 text-2xl font-bold">{sessions.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">📅</div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Working sets</p>
              <p className="mt-1 text-2xl font-bold">{workingSets.length}</p>
            </div>
            <div className="rounded-xl bg-blue-500/10 p-3">📚</div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Tổng volume</p>
              <p className="mt-1 text-2xl font-bold">
                {Math.round(totalVolume).toLocaleString()} <span className="text-xs font-normal text-slate-400">kg</span>
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3">⚡</div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Top loaded weight</p>
              <p className="mt-1 text-2xl font-bold">{maxLoadedWeight} kg</p>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-3">🏆</div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl sm:p-6">
              <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl" />

              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="font-semibold">✍️ Ghi buổi tập mới</h2>
                  <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                  V2 · Supabase
                </span>
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Chọn nhanh bài tập</p>
                  <span className="text-[11px] text-slate-500">nhấp để áp dụng</span>
                </div>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {exercises.slice(0, 12).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setExerciseId(item.id)}
                      className={
                        exerciseId === item.id
                          ? 'rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300'
                          : 'rounded-lg border border-slate-700 bg-[#090d16] px-2.5 py-1 text-xs text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800'
                      }
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Tên buổi</label>
                  <input
                    value={sessionTitle}
                    onChange={(event) => setSessionTitle(event.target.value)}
                    placeholder="Push Day A"
                    className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Ngày tập</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(event) => setSessionDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-300">Bài tập</label>
                <select
                  value={exerciseId}
                  onChange={(event) => setExerciseId(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  {exercises.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.muscle_group}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-[#090d16]/70 p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Tạ kg</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={weight}
                      onChange={(event) => setWeight(event.target.value)}
                      placeholder="0 = BW"
                      className="w-full rounded-lg border border-slate-700 bg-[#0f172a] px-2.5 py-2 text-center text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Reps</label>
                    <input
                      type="number"
                      min="1"
                      value={reps}
                      onChange={(event) => setReps(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#0f172a] px-2.5 py-2 text-center text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">RIR</label>
                    <input
                      type="number"
                      min="0"
                      max="4"
                      value={rir}
                      onChange={(event) => setRir(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#0f172a] px-2.5 py-2 text-center text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={isWarmup}
                      onChange={(event) => setIsWarmup(event.target.checked)}
                    />
                    Warm-up
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={repeatLastSet}
                    className="rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Copy set trước
                  </button>
                  <button
                    type="button"
                    onClick={addDraftSet}
                    className="rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    + Thêm set
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Danh sách sets</p>
                  <span className="text-[11px] text-slate-500">{draftSets.length} set</span>
                </div>
                <div className="space-y-2">
                  {draftSets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 py-7 text-center text-xs text-slate-500">
                      Thêm set đầu tiên để bắt đầu.
                    </div>
                  ) : (
                    draftSets.map((set, index) => {
                      const item = exercises.find((exercise) => exercise.id === set.exercise_id)
                      return (
                        <div key={set.tempId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#090d16]/70 p-3">
                          <div>
                            <p className="text-sm font-semibold">
                              <span className="mr-2 font-mono text-xs text-slate-500">#{index + 1}</span>
                              {item?.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {displayWeight(set.weight_kg)} × {set.reps} · RIR {set.rir}
                              {set.is_warmup ? ' · warm-up' : ''}
                            </p>
                          </div>
                          <button onClick={() => removeDraftSet(set.tempId)} className="text-xs text-red-400 hover:text-red-300">
                            Xóa
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-slate-300">
                <span className="font-semibold text-emerald-400">Mốc gần nhất:</span> {nextTarget}
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-300">Ghi chú</label>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Form, cảm giác, rest..."
                  className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={saveSession}
                disabled={saving || draftSets.length === 0}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50"
              >
                {saving ? 'ĐANG LƯU...' : 'LƯU BUỔI TẬP & TÍNH TĂNG TIẾN'}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-xs text-slate-400">
              <p className="font-semibold text-emerald-400">✨ Mẹo Progressive Overload</p>
              <p className="mt-2 leading-5">
                Tăng tiến bằng cách tăng tạ, thêm reps hoặc cải thiện chất lượng set. Đừng tăng tạ nếu form bắt đầu vỡ.
              </p>
            </div>
          </section>

          <section className="space-y-6 lg:col-span-7">
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl">
              <div className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">📈 Biểu đồ tiến trình theo bài tập</h2>
                  <p className="mt-1 text-xs text-slate-400">Estimated 1RM của {selectedExercise?.name ?? 'bài đang chọn'}</p>
                </div>
                {exerciseStats.bestE1rm > 0 && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                    PR e1RM {exerciseStats.bestE1rm.toFixed(1)} kg
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#090d16] p-3">
                  <p className="text-[11px] text-slate-500">Tạ nặng nhất</p>
                  <p className="mt-1 font-bold">{exerciseStats.bestWeight > 0 ? `${exerciseStats.bestWeight} kg` : '—'}</p>
                </div>
                <div className="rounded-xl bg-[#090d16] p-3">
                  <p className="text-[11px] text-slate-500">Reps cao nhất</p>
                  <p className="mt-1 font-bold">{exerciseStats.bestReps || '—'}</p>
                </div>
                <div className="rounded-xl bg-[#090d16] p-3">
                  <p className="text-[11px] text-slate-500">e1RM PR</p>
                  <p className="mt-1 font-bold">{exerciseStats.bestE1rm > 0 ? `${exerciseStats.bestE1rm.toFixed(1)} kg` : '—'}</p>
                </div>
              </div>

              <div className="relative mt-4 h-60 rounded-xl border border-slate-800 bg-[#090d16]/60 p-4">
                {exerciseStats.chartPoints.length > 0 ? (
                  <>
                    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
                      <line x1="0" y1="90" x2="100" y2="90" stroke="currentColor" className="text-slate-800" strokeWidth="1" />
                      <polyline
                        points={chartPolyline}
                        fill="none"
                        stroke="currentColor"
                        className="text-emerald-400"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                      {exerciseStats.chartPoints.map((point, index) => {
                        const values = exerciseStats.chartPoints.map((item) => item.value)
                        const min = Math.min(...values)
                        const max = Math.max(...values)
                        const span = Math.max(max - min, 1)
                        const x = exerciseStats.chartPoints.length === 1 ? 50 : (index / (exerciseStats.chartPoints.length - 1)) * 100
                        const y = 90 - ((point.value - min) / span) * 75
                        return <circle key={point.date} cx={x} cy={y} r="1.7" fill="currentColor" className="text-emerald-300" />
                      })}
                    </svg>
                    <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] text-slate-600">
                      <span>{formatDate(exerciseStats.chartPoints[0].date)}</span>
                      <span>{formatDate(exerciseStats.chartPoints[exerciseStats.chartPoints.length - 1].date)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-500">
                    <div className="mb-2 text-3xl opacity-50">📉</div>
                    Chưa có đủ dữ liệu cho bài này.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">🕘 Lịch sử bài tập & đánh giá overload</h2>
                  <p className="mt-1 text-xs text-slate-400">{filteredSessions.length} buổi tập</p>
                </div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm bài tập / session..."
                  className="rounded-lg border border-slate-700 bg-[#090d16] px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                {filteredSessions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">Chưa có dữ liệu phù hợp.</div>
                ) : (
                  filteredSessions.map((session) => {
                    const groups = new Map<string, SetRow[]>()
                    session.workout_sets.forEach((set) => {
                      const list = groups.get(set.exercise_id) ?? []
                      list.push(set)
                      groups.set(set.exercise_id, list)
                    })

                    return (
                      <article key={session.id} className="rounded-xl border border-slate-800 bg-[#090d16]/75 p-4 hover:border-slate-700">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold">{session.title}</h3>
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                Logged
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{formatDate(session.session_date)}</p>
                          </div>
                          <button onClick={() => deleteSession(session.id)} className="text-xs text-slate-500 hover:text-red-400">
                            Xóa
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                          {[...groups.values()].map((setsForExercise) => {
                            const first = setsForExercise[0]
                            const volume = setsForExercise
                              .filter((set) => !set.is_warmup)
                              .reduce((sum, set) => sum + Number(set.weight_kg) * set.reps, 0)

                            return (
                              <div key={first.exercise_id} className="rounded-lg border border-slate-800 bg-[#0f172a] p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold">{first.exercise?.name ?? 'Exercise'}</p>
                                  <span className="text-[11px] text-slate-500">{Math.round(volume)} kg volume</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {setsForExercise.map((set) => (
                                    <span key={set.id} className="rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-xs text-slate-300">
                                      <span className="font-mono text-[10px] text-slate-600">#{set.set_number}</span>{' '}
                                      <strong>{displayWeight(Number(set.weight_kg))}</strong> × <strong>{set.reps}</strong>
                                      {set.rpe !== null ? ` · RIR ${Math.max(0, Math.round(10 - set.rpe))}` : ''}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {session.notes && <p className="mt-3 truncate text-xs italic text-slate-500">“{session.notes}”</p>}
                      </article>
                    )
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {showTimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-800 bg-[#0f172a] p-6 text-center shadow-2xl">
            <button onClick={() => setShowTimer(false)} className="absolute right-4 top-4 text-slate-500 hover:text-white">✕</button>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-2xl">⏱</div>
            <h3 className="text-lg font-bold">Đồng hồ nghỉ giữa hiệp</h3>
            <p className="mt-1 text-xs text-slate-400">Chọn thời gian nghỉ rồi bắt đầu set tiếp theo.</p>
            <div className="my-6 font-mono text-6xl font-extrabold tracking-tight text-emerald-400">{formatTimer(timerSeconds)}</div>

            <div className="mb-5 grid grid-cols-4 gap-2">
              {[45, 60, 90, 180].map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => setTimerPreset(seconds)}
                  className="rounded-lg border border-slate-700 bg-[#090d16] py-1.5 text-xs font-semibold hover:bg-slate-800"
                >
                  {seconds === 180 ? '3p' : `${seconds}s`}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (timerSeconds === 0) setTimerSeconds(90)
                  setTimerRunning((running) => !running)
                }}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
              >
                {timerRunning ? 'Tạm dừng' : 'Bắt đầu'}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false)
                  setTimerSeconds(90)
                }}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Đặt lại
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
