import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { defaultRoute } from '../lib/permissions'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { HE } from '../constants/hebrew'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      navigate(defaultRoute(user.role), { replace: true })
    }
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await login(email, password)
    } catch {
      setError(HE.auth.loginError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <img src="/logo.png" alt="4MP" className="h-20 w-auto" />
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-gray-900">
          {HE.auth.loginTitle}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            label={HE.auth.email}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <Input
            type="password"
            label={HE.auth.password}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? HE.auth.loggingIn : HE.auth.loginButton}
          </Button>
        </form>
      </div>
    </div>
  )
}
