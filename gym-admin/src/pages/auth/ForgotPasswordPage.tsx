import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/api/auth.api'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { ArrowLeft, MailCheck } from 'lucide-react'

const schema = z.object({ email: z.string().email('Invalid email address') })
type Form = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    try {
      await authApi.forgotPassword(data.email)
      setSent(true)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Request failed')
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-6 h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.15))',
            border: '1px solid rgba(249,115,22,0.3)',
          }}
        >
          <MailCheck className="h-8 w-8" style={{ color: '#f97316' }} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Check your inbox</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          We've sent password reset instructions to<br />
          <span className="font-medium text-slate-700 dark:text-slate-300">{getValues('email')}</span>
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: '#f97316' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Forgot password?</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No worries — enter your email and we'll send reset instructions.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email address</Label>
          <Input id="email" type="email" placeholder="you@gymapp.com" className="h-11" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold"
          loading={isSubmitting}
          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none' }}
        >
          Send reset link
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
