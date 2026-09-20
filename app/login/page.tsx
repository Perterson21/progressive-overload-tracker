'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'

export default function Login() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  const signUp = async () => {
    if (!email || password.length < 6) {
      setMessage('Nhập email hợp lệ và password ít nhất 6 ký tự.')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Đã tạo tài khoản. Kiểm tra email nếu Supabase yêu cầu xác nhận.')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl md:p-8">
          <p className="text-sm font-semibold text-blue-400">PROGRESSIVE OVERLOAD</p>
          <h1 className="mt-2 text-3xl font-bold">Đăng nhập</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Theo dõi mức tạ, reps, RIR và mục tiêu cho buổi tập tiếp theo.
          </p>

          <form onSubmit={login} className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-blue-500"
              />
            </div>

            {message && (
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP'}
            </button>

            <button
              type="button"
              onClick={signUp}
              disabled={loading}
              className="w-full rounded-lg border border-slate-700 px-4 py-3 font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              TẠO TÀI KHOẢN
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
