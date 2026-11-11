import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/api/auth.api'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { ArrowLeft, KeyRound } from 'lucide-react'

const schema = z
  .object({
    password: z.string().min(8, 'Minimum 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    try {
      await authApi.resetPassword(token, data.password)
      toast.success('Password reset successfully')
      navigate('/login')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Reset failed')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div
          className="mb-5 h-12 w-12 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.15))',
            border: '1px solid rgba(249,115,22,0.3)',
          }}
        >
          <KeyRound className="h-6 w-6" style={{ color: '#f97316' }} />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Set new password</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Must be at least 8 characters long.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">New password</Label>
          <Input id="password" type="password" placeholder="••••••••" className="h-11" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-slate-700 dark:text-slate-300">Confirm password</Label>
          <Input id="confirm" type="password" placeholder="••••••••" className="h-11" {...register('confirm')} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold"
          loading={isSubmitting}
          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none' }}
        >
          Reset password
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: '#f97316' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
