'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

type Capture = {
  id: string
  email: string
  password: string
  capturedAt: string
  userAgent: string
}

const STORAGE_KEY = 'security_lab_captures_v1'

export default function SecurityLabPage() {
  const [email, setEmail] = useState('friend@example.com')
  const [password, setPassword] = useState('demo-password123')
  const [message, setMessage] = useState('')
  const [count, setCount] = useState(0)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Capture[]
    setCount(saved.length)
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()

    if (!email.toLowerCase().endsWith('@example.com')) {
      setMessage('Lab chỉ chấp nhận email giả có đuôi @example.com.')
      return
    }

    if (!password.startsWith('demo-')) {
      setMessage('Lab chỉ chấp nhận mật khẩu giả bắt đầu bằng demo-.')
      return
    }

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Capture[]
    const capture: Capture = {
      id: crypto.randomUUID(),
      email,
      password,
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify([capture, ...saved]))
    setCount(saved.length + 1)
    setMessage('Demo credential đã bị “capture”. Mở trang Lab Admin để xem dữ liệu.')
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← GymTracker</Link>
          <Link href="/security-lab/admin" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900">
            Lab Admin ({count})
          </Link>
        </div>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-bold">Controlled Security Lab</p>
          <p className="mt-1 leading-6">
            Chỉ dùng dữ liệu giả. Form sẽ từ chối email thật và mật khẩu không bắt đầu bằng <code>demo-</code>.
            Dữ liệu demo chỉ được lưu trong trình duyệt này để minh họa credential capture.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Unsafe login simulation</p>
            <h1 className="mt-2 text-2xl font-bold">Sign in to DemoPortal</h1>
            <p className="mt-2 text-sm text-slate-400">
              Trang này minh họa một website độc hại có thể nhận dữ liệu form trước khi người dùng nhận ra.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Demo email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-red-500"
              />
              <p className="mt-1 text-xs text-slate-500">Phải kết thúc bằng @example.com</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Demo password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-red-500"
              />
              <p className="mt-1 text-xs text-slate-500">Phải bắt đầu bằng demo-</p>
            </div>

            <button className="w-full rounded-xl bg-red-500 px-4 py-3 font-bold text-white hover:bg-red-400">
              Submit demo credential
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
              {message}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm">
          <h2 className="font-bold">Bạn đang học gì ở đây?</h2>
          <div className="mt-3 space-y-2 text-slate-400">
            <p>1. Trình duyệt gửi dữ liệu form cho code mà website kiểm soát.</p>
            <p>2. Website độc hại có thể lưu credential thay vì đăng nhập thật.</p>
            <p>3. HTTPS chỉ mã hóa đường truyền; nó không chứng minh website đáng tin.</p>
            <p>4. Password manager, MFA và passkeys giúp giảm rủi ro credential phishing.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
