'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<any[]>([])

  // Form states cho Progressive Overload
  const [exercise, setExercise] = useState('Pull-up')
  const [weight, setWeight] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        fetchWorkouts(user.id)
      }
      setLoading(false)
    }
    checkUser()
  }, [router, supabase])

  const fetchWorkouts = async (userId: string) => {
    // RLS của Supabase sẽ tự động chỉ trả về dữ liệu của user đang đăng nhập
    const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) console.error('Lỗi tải dữ liệu:', error)
    else setWorkouts(data || [])
  }

  const handleAddWorkout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exercise || !weight || !sets || !reps) return alert('Vui lòng nhập đủ thông số!')

    const { error } = await supabase
        .from('workouts')
        .insert([
          {
            user_id: user.id,
            exercise_name: exercise,
            weight: parseFloat(weight),
            sets: parseInt(sets),
            reps: parseInt(reps),
            rir: 1 // Chỉ số mặc định cho V1
          }
        ])

    if (error) {
      alert('Lỗi lưu dữ liệu: ' + error.message)
    } else {
      setWeight('')
      setSets('')
      setReps('')
      fetchWorkouts(user.id)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Đang tải...</div>

  return (
      <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
            <h1 className="text-2xl font-bold">Progressive Overload V1</h1>
            <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-700 transition">Đăng xuất</button>
          </div>

          {/* Panel Ghi chép Tập luyện */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl mb-4 font-semibold text-blue-400">Ghi chép Set Tập</h2>
            <form onSubmit={handleAddWorkout} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Bài tập</label>
                <input type="text" value={exercise} onChange={e => setExercise(e.target.value)} className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Mức tạ (kg - Bodyweight nhập 0)</label>
                <input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Số Set</label>
                <input type="number" value={sets} onChange={e => setSets(e.target.value)} className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Số Rep mỗi Set</label>
                <input type="number" value={reps} onChange={e => setReps(e.target.value)} className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-2 mt-2">
                <button type="submit" className="w-full bg-blue-600 p-3 rounded hover:bg-blue-700 transition font-bold tracking-wide">LƯU KẾT QUẢ</button>
              </div>
            </form>
          </div>

          {/* Lịch sử tập luyện */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl mb-4 font-semibold text-blue-400">Lịch sử Gần đây</h2>
            {workouts.length === 0 ? (
                <p className="text-gray-400 italic">Chưa có dữ liệu nào. Hãy nhập set tập đầu tiên của bạn!</p>
            ) : (
                <div className="space-y-3">
                  {workouts.map(w => (
                      <div key={w.id} className="p-3 bg-gray-700 rounded border border-gray-600 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-white">{w.exercise_name}</span>
                          <span className="text-gray-400 ml-2">({w.weight} kg)</span>
                        </div>
                        <div className="text-sm font-mono text-gray-300">
                          {w.sets} sets x {w.reps} reps
                        </div>
                      </div>
                  ))}
                </div>
            )}
          </div>
        </div>
      </main>
  )
}