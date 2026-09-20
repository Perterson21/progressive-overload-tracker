'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'

type Workout = {
  id: string
  user_id: string
  exercise_name: string
  weight: number
  reps: number
  sets: number
  rir: number | null
  created_at: string
}

const exerciseSuggestions = [
  'Incline Dumbbell Press',
  'Bench Press',
  'Pull-up',
  'Weighted Pull-up',
  'Lat Pulldown',
  'Barbell Row',
  'Seated Cable Row',
  'Shoulder Press',
  'Lateral Raise',
  'Rear Delt Fly',
  'Bicep Curl',
  'Tricep Pushdown',
  'Squat',
  'Leg Press',
  'Romanian Deadlift',
  'Leg Curl',
  'Leg Extension',
  'Calf Raise',
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function Home() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [search, setSearch] = useState('')

  const [exercise, setExercise] = useState('Pull-up')
  const [weight, setWeight] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('')
  const [rir, setRir] = useState('1')

  const fetchWorkouts = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error(error)
      return
    }

    setWorkouts((data ?? []) as Workout[])
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
      await fetchWorkouts()
      setLoading(false)
    }

    load()
  }, [router, supabase])

  const handleAddWorkout = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return

    const parsedWeight = Number(weight)
    const parsedSets = Number(sets)
    const parsedReps = Number(reps)
    const parsedRir = Number(rir)

    if (!exercise.trim()) return alert('Nhập tên bài tập.')
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) return alert('Mức tạ không hợp lệ.')
    if (!Number.isInteger(parsedSets) || parsedSets < 1 || parsedSets > 20) return alert('Số set phải từ 1–20.')
    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 100) return alert('Số rep không hợp lệ.')
    if (!Number.isInteger(parsedRir) || parsedRir < 0 || parsedRir > 10) return alert('RIR phải từ 0–10.')

    setSaving(true)

    const { error } = await supabase.from('workouts').insert({
      user_id: user.id,
      exercise_name: exercise.trim(),
      weight: parsedWeight,
      sets: parsedSets,
      reps: parsedReps,
      rir: parsedRir,
    })

    if (error) {
      alert('Không lưu được: ' + error.message)
      setSaving(false)
      return
    }

    setReps('')
    await fetchWorkouts()
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const sameExercise = workouts.filter(
    (workout) => workout.exercise_name.toLowerCase() === exercise.trim().toLowerCase(),
  )
  const previous = sameExercise[0]

  const recommendation = useMemo(() => {
    if (!previous) return 'Chưa có dữ liệu cho bài này. Hãy ghi buổi đầu tiên để tạo mốc.'

    const currentRir = previous.rir ?? 1

    if (previous.reps >= 12 && currentRir >= 1) {
      if (previous.weight === 0) {
        return `Buổi trước: BW × ${previous.reps}. Nếu form vẫn sạch, thử +2.5 kg ở 6–8 reps.`
      }
      return `Buổi trước: ${previous.weight} kg × ${previous.reps}. Thử ${previous.weight + 2.5} kg ở 6–8 reps.`
    }

    if (currentRir === 0) {
      return `Buổi trước: ${previous.weight === 0 ? 'BW' : previous.weight + ' kg'} × ${previous.reps} @ RIR 0. Giữ mức hiện tại và cố đạt cùng reps với form tốt hơn / RIR ≥ 1.`
    }

    return `Buổi trước: ${previous.weight === 0 ? 'BW' : previous.weight + ' kg'} × ${previous.reps} @ RIR ${currentRir}. Mục tiêu: cùng mức tạ × ${Math.min(previous.reps + 1, 12)} reps.`
  }, [previous])

  const filteredWorkouts = workouts.filter((workout) =>
    workout.exercise_name.toLowerCase().includes(search.toLowerCase()),
  )

  const today = new Date().toDateString()
  const todayLogs = workouts.filter((workout) => new Date(workout.created_at).toDateString() === today)
  const loadedVolume = workouts.reduce(
    (sum, workout) => sum + workout.weight * workout.reps * workout.sets,
    0,
  )
  const maxWeight = workouts.reduce((max, workout) => Math.max(max, workout.weight), 0)

  const loadPrevious = (workout: Workout) => {
    setExercise(workout.exercise_name)
    setWeight(String(workout.weight))
    setSets(String(workout.sets))
    setReps(String(workout.reps))
    setRir(String(workout.rir ?? 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Đang tải dữ liệu...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-400">TRAINING DASHBOARD</p>
            <h1 className="text-3xl font-bold tracking-tight">Progressive Overload Tracker</h1>
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
            <p className="text-xs uppercase tracking-wide text-slate-500">Logs hôm nay</p>
            <p className="mt-1 text-2xl font-bold">{todayLogs.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tổng logs</p>
            <p className="mt-1 text-2xl font-bold">{workouts.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Loaded volume</p>
            <p className="mt-1 text-2xl font-bold">{Math.round(loadedVolume).toLocaleString()} kg</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tạ cao nhất</p>
            <p className="mt-1 text-2xl font-bold">{maxWeight || 0} kg</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold">Ghi buổi tập</h2>
              <p className="text-sm text-slate-400">Mỗi log là một exercise trong một buổi.</p>
            </div>

            <form onSubmit={handleAddWorkout} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm text-slate-400">Bài tập</label>
                <input
                  list="exercise-list"
                  value={exercise}
                  onChange={(event) => setExercise(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                />
                <datalist id="exercise-list">
                  {exerciseSuggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-400">Mức tạ (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="BW = 0"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-400">Số set</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={sets}
                  onChange={(event) => setSets(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-400">Reps / set</label>
                <input
                  type="number"
                  min="1"
                  value={reps}
                  onChange={(event) => setReps(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-400">RIR</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={rir}
                  onChange={(event) => setRir(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="col-span-2 rounded-lg bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'ĐANG LƯU...' : 'LƯU KẾT QUẢ'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-blue-900/60 bg-blue-950/30 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Next target</p>
            <h2 className="mt-2 text-xl font-bold">{exercise || 'Chọn bài tập'}</h2>
            <p className="mt-4 leading-7 text-slate-300">{recommendation}</p>
            <div className="mt-5 rounded-lg bg-slate-950/60 p-3 text-xs text-slate-500">
              Gợi ý dùng double progression 6–12 reps. Đây là target thực hành, không thay thế đánh giá form và mức mệt thực tế.
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Lịch sử</h2>
              <p className="text-sm text-slate-400">100 logs gần nhất.</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm bài tập..."
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {filteredWorkouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-slate-500">
              Chưa có dữ liệu phù hợp.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkouts.map((workout) => (
                <article
                  key={workout.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{workout.exercise_name}</h3>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {formatDate(workout.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {workout.weight === 0 ? 'Bodyweight' : `${workout.weight} kg`} · {workout.sets} × {workout.reps}
                      {workout.rir !== null ? ` · RIR ${workout.rir}` : ''}
                    </p>
                  </div>

                  <button
                    onClick={() => loadPrevious(workout)}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium hover:border-blue-500 hover:text-blue-400"
                  >
                    Dùng lại
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
