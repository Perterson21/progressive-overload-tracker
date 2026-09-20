'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Capture = {
  id: string
  email: string
  password: string
  capturedAt: string
  userAgent: string
}

const STORAGE_KEY = 'security_lab_captures_v1'

export default function SecurityLabAdminPage() {
  const [captures, setCaptures] = useState<Capture[]>([])

  const load = () => {
    setCaptures(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  }

  useEffect(() => {
    load()
  }, [])

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCaptures([])
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/security-lab" className="text-sm text-slate-400 hover:text-white">← Security Lab</Link>
          <button onClick={clear} className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 hover:bg-red-950/40">
            Clear demo captures
          </button>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Lab Admin</p>
          <h1 className="mt-2 text-2xl font-bold">Captured demo credentials</h1>
          <p className="mt-2 text-sm text-slate-400">
            Đây là dữ liệu giả được capture trên chính trình duyệt này. Không có account thật nào được gửi hoặc lưu.
          </p>

          <div className="mt-6 space-y-3">
            {captures.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-slate-500">
                Chưa có demo capture nào.
              </div>
            ) : (
              captures.map((capture) => (
                <article key={capture.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-mono text-sm">{capture.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Captured password</p>
                      <p className="font-mono text-sm text-red-300">{capture.password}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Captured at</p>
                      <p className="text-sm">{new Date(capture.capturedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Browser / user agent</p>
                      <p className="break-all text-xs text-slate-400">{capture.userAgent}</p>
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
