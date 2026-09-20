'use client'
import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else router.push('/')
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Đăng ký thành công! Hãy kiểm tra email để xác nhận (nếu Supabase yêu cầu).')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form className="flex flex-col gap-4 p-8 bg-gray-800 rounded-lg shadow-lg w-96">
        <h1 className="text-2xl font-bold mb-4 text-center">Xác thực người dùng</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none"
        />
        <div className="flex gap-4 mt-2">
          <button onClick={handleLogin} className="flex-1 bg-blue-600 p-2 rounded hover:bg-blue-700 transition">Đăng nhập</button>
          <button onClick={handleSignUp} className="flex-1 bg-gray-600 p-2 rounded hover:bg-gray-700 transition">Đăng ký</button>
        </div>
      </form>
    </div>
  )
}