import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/store/auth.store'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuthStore()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await authApi.login(data.email, data.password)
      localStorage.setItem('gym_refresh_token', res.tokens.refresh_token)
      setAuth(res.user, res.tokens.access_token)
      toast.success(`Welcome back, ${res.user.first_name}!`)
      navigate(from, { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed'
      toast.error(message)
    }
  }

  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Login
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@gymapp.com"
            className="h-11"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium hover:underline"
              style={{ color: '#f97316' }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="h-11 pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold gap-2"
          loading={isSubmitting}
          style={{
            background: isSubmitting ? undefined : 'linear-gradient(135deg, #f97316, #ea580c)',
            border: 'none',
          }}
        >
          Sign in to dashboard
          {!isSubmitting && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white dark:bg-slate-950 px-3 text-xs text-slate-400">
            Default credentials (seed data)
          </span>
        </div>
      </div>

      {/* Quick-fill hint cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { role: 'Admin', email: 'admin@gymapp.com', password: 'Admin@123456' },
          { role: 'Manager', email: 'manager@gymapp.com', password: 'Manager@123456' },
        ].map((cred) => (
          <button
            key={cred.role}
            type="button"
            onClick={() => {
              setValue('email', cred.email, { shouldValidate: true })
              setValue('password', cred.password, { shouldValidate: true })
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-orange-300 hover:bg-orange-50 dark:hover:border-orange-900 dark:hover:bg-orange-950/30 transition-colors group"
          >
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400">
              {cred.role}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-600 mt-0.5 truncate">
              {cred.email}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
