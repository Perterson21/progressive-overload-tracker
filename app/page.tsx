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
        tempId: crypto.randomUUID(),
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
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Đang tải V2...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-400">PROGRESSIVE OVERLOAD · V2</p>
            <h1 className="text-3xl font-bold tracking-tight">Workout Tracker</h1>
            <p className="mt-1 text-sm text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-900"
          >
            Đăng xuất
          </button>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Buổi tập</p>
            <p className="mt-1 text-2xl font-bold">{sessions.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Working sets</p>
            <p className="mt-1 text-2xl font-bold">{workingSets.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Volume</p>
            <p className="mt-1 text-2xl font-bold">{Math.round(totalVolume).toLocaleString()} kg</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Top loaded weight</p>
            <p className="mt-1 text-2xl font-bold">{maxLoadedWeight} kg</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
            <h2 className="text-xl font-bold">Buổi tập hiện tại</h2>
            <p className="mt-1 text-sm text-slate-400">Thêm từng set thật thay vì ghi gộp 3 × 10.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-slate-400">Tên buổi</label>
                <input
                  value={sessionTitle}
                  onChange={(event) => setSessionTitle(event.target.value)}
                  placeholder="Push Day A"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-slate-400">Ngày</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(event) => setSessionDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div>
                <label className="mb-1.5 block text-sm text-slate-400">Bài tập</label>
                <select
                  value={exerciseId}
                  onChange={(event) => setExerciseId(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                >
                  {exercises.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.muscle_group}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Weight kg</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    placeholder="0 = BW"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Reps</label>
                  <input
                    type="number"
                    min="1"
                    value={reps}
                    onChange={(event) => setReps(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">RIR</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={rir}
                    onChange={(event) => setRir(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none"
                  />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={isWarmup}
                    onChange={(event) => setIsWarmup(event.target.checked)}
                  />
                  Warm-up
                </label>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={repeatLastSet}
                  className="rounded-lg border border-slate-700 px-3 py-2.5 font-medium hover:bg-slate-800"
                >
                  Copy set trước
                </button>
                <button
                  type="button"
                  onClick={addDraftSet}
                  className="rounded-lg bg-blue-600 px-3 py-2.5 font-bold hover:bg-blue-500"
                >
                  + Thêm set
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Sets đang ghi</h3>
                <span className="text-sm text-slate-500">{draftSets.length} sets</span>
              </div>

              {draftSets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 py-7 text-center text-sm text-slate-500">
                  Chưa có set nào.
                </div>
              ) : (
                <div className="space-y-2">
                  {draftSets.map((set, index) => {
                    const item = exercises.find((exercise) => exercise.id === set.exercise_id)
                    return (
                      <div
                        key={set.tempId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {index + 1}. {item?.name ?? 'Exercise'}
                            {set.is_warmup && (
                              <span className="ml-2 rounded bg-amber-950 px-2 py-0.5 text-xs text-amber-300">
                                warm-up
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-slate-400">
                            {displayWeight(set.weight_kg)} × {set.reps} @ RIR {set.rir}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDraftSet(set.tempId)}
                          className="text-sm text-red-400 hover:text-red-300"
                        >
                          Xóa
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm text-slate-400">Ghi chú buổi tập</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={saveSession}
              disabled={saving || draftSets.length === 0}
              className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'ĐANG LƯU...' : 'HOÀN THÀNH BUỔI TẬP'}
            </button>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-blue-900/60 bg-blue-950/30 p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Next target</p>
              <h2 className="mt-2 text-xl font-bold">{selectedExercise?.name ?? 'Chọn bài tập'}</h2>
              <p className="mt-4 leading-7 text-slate-300">{nextTarget}</p>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Rule hiện tại: double progression 6–12 reps. App dùng RPE lưu trong DB và hiển thị RIR cho dễ tập.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
              <h2 className="font-bold">Progress gần nhất</h2>
              <div className="mt-4 space-y-2">
                {exerciseHistory.slice(0, 5).map((set) => (
                  <div key={set.id} className="flex justify-between rounded-lg bg-slate-950/60 p-3 text-sm">
                    <span className="text-slate-400">{formatDate(set.sessionDate)}</span>
                    <span>
                      {displayWeight(set.weight_kg)} × {set.reps} · RIR{' '}
                      {set.rpe === null ? '?' : Math.max(0, Math.round(10 - set.rpe))}
                    </span>
                  </div>
                ))}
                {exerciseHistory.length === 0 && (
                  <p className="text-sm text-slate-500">Chưa có history cho bài này.</p>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Lịch sử buổi tập</h2>
              <p className="text-sm text-slate-400">Session → exercise → từng set.</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm Push Day, Pull-up..."
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {filteredSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-slate-500">
              Chưa có buổi tập nào.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session) => {
                const groups = new Map<string, SetRow[]>()
                session.workout_sets.forEach((set) => {
                  const list = groups.get(set.exercise_id) ?? []
                  list.push(set)
                  groups.set(set.exercise_id, list)
                })

                return (
                  <article key={session.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{session.title}</h3>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                            {formatDate(session.session_date)}
                          </span>
                        </div>
                        {session.notes && <p className="mt-1 text-sm text-slate-400">{session.notes}</p>}
                      </div>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Xóa session
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[...groups.values()].map((setsForExercise) => {
                        const first = setsForExercise[0]
                        return (
                          <div key={first.exercise_id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                            <p className="font-semibold">{first.exercise?.name ?? 'Exercise'}</p>
                            <div className="mt-2 space-y-1 text-sm text-slate-400">
                              {setsForExercise.map((set) => (
                                <p key={set.id}>
                                  Set {set.set_number}: {displayWeight(Number(set.weight_kg))} × {set.reps}
                                  {set.rpe !== null ? ` @ RIR ${Math.max(0, Math.round(10 - set.rpe))}` : ''}
                                  {set.is_warmup ? ' · warm-up' : ''}
                                </p>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
