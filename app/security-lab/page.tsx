'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/client'

export default function SecurityLabPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const setup = async () => {
      const params = new URLSearchParams(window.location.search)
      const ownerFromUrl = params.get('owner') || ''

      const { data } = await supabase.auth.getUser()
      const currentUserId = data.user?.id || ''

      if (ownerFromUrl) {
        setOwnerId(ownerFromUrl)
        setIsOwner(currentUserId === ownerFromUrl)
        return
      }

      if (currentUserId) {
        setOwnerId(currentUserId)
        setIsOwner(true)
        setShareUrl(`${window.location.origin}/security-lab?owner=${currentUserId}`)
      }
    }

    setup()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')

    if (!ownerId) {
      setMessage('Thiếu lab owner. Hãy dùng share link được tạo bởi chủ lab.')
      return
    }

    if (!email.toLowerCase().endsWith('@example.com')) {
      setMessage('Lab chỉ chấp nhận email giả có đuôi @example.com.')
      return
    }

    if (!password.startsWith('demo-')) {
      setMessage('Lab chỉ chấp nhận mật khẩu giả bắt đầu bằng demo-.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('security_lab_captures').insert({
      owner_user_id: ownerId,
      email,
      demo_password: password,
      user_agent: navigator.userAgent,
    })

    setSubmitting(false)

    if (error) {
      setMessage(`Chưa ghi được vào database: ${error.message}`)
      return
    }

    setMessage('Demo credential đã được capture vào lab database. Chủ lab có thể xem từ máy khác.')
    setPassword('')
  }

  const copyShareLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setMessage('Đã copy share link.')
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← GymTracker</Link>
          {isOwner && (
            <Link href="/security-lab/admin" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900">
              Lab Admin
            </Link>
          )}
        </div>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-bold">Controlled Security Lab</p>
          <p className="mt-1 leading-6">
            Chỉ dùng dữ liệu giả. Email thật và password không bắt đầu bằng <code>demo-</code> sẽ bị từ chối cả ở giao diện lẫn database.
          </p>
        </section>

        {isOwner && shareUrl && (
          <section className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-300">Cross-device share link</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-300">{shareUrl}</p>
            <button onClick={copyShareLink} className="mt-3 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950">
              Copy link
            </button>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Unsafe login simulation</p>
            <h1 className="mt-2 text-2xl font-bold">Sign in to DemoPortal</h1>
            <p className="mt-2 text-sm text-slate-400">
              Mô phỏng cách một website có thể nhận dữ liệu form. Không dùng account hoặc password thật.
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
              <div className="flex gap-2">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="demo-your-password"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="rounded-xl border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Phải bắt đầu bằng demo-. Không có password mặc định.</p>
            </div>

            <button
              disabled={submitting}
              className="w-full rounded-xl bg-red-500 px-4 py-3 font-bold text-white hover:bg-red-400 disabled:opacity-50"
            >
              {submitting ? 'Capturing demo...' : 'Submit demo credential'}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
              {message}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm">
          <h2 className="font-bold">Flow của lab</h2>
          <div className="mt-3 space-y-2 text-slate-400">
            <p>Friend browser → dummy form → Supabase lab table → owner admin page.</p>
            <p>RLS chỉ cho chủ lab đọc/xóa captures của chính lab mình.</p>
            <p>Database có CHECK constraint để chặn credential không phải dummy.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
