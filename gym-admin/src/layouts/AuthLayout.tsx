import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Zap, Users, BarChart3, ShieldCheck, Dumbbell } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'

const GYM_SLIDES = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1280&q=80', // gym floor
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1280&q=80', // weightlifting
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1280&q=80', // athlete
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1280&q=80', // equipment
  'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=1280&q=80', // crossfit
]

const SLIDE_DURATION = 5000 // ms each slide is fully visible
const FADE_DURATION  = 1000 // ms crossfade

const features = [
  { icon: <Users className="h-5 w-5" />,       text: 'Manage members, plans & subscriptions' },
  { icon: <Dumbbell className="h-5 w-5" />,    text: 'Schedule classes & track attendance' },
  { icon: <BarChart3 className="h-5 w-5" />,   text: 'Revenue reports & business insights' },
  { icon: <ShieldCheck className="h-5 w-5" />, text: 'Role-based access for your entire team' },
]

const stats = [
  { value: '10K+', label: 'Members managed' },
  { value: '500+', label: 'Classes scheduled' },
  { value: '99.9%', label: 'Uptime' },
]

function GymSlideshow() {
  const [current, setCurrent] = useState(0)
  const [prev, setPrev]       = useState<number | null>(null)
  const [fading, setFading]   = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (current + 1) % GYM_SLIDES.length
      setPrev(current)
      setCurrent(next)
      setFading(true)
      setTimeout(() => { setPrev(null); setFading(false) }, FADE_DURATION)
    }, SLIDE_DURATION + FADE_DURATION)
    return () => clearInterval(timer)
  }, [current])

  return (
    <>
      {/* Outgoing slide fades out */}
      {prev !== null && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${GYM_SLIDES[prev]})`,
            opacity: fading ? 0 : 1,
            transition: `opacity ${FADE_DURATION}ms ease-in-out`,
            transform: 'scale(1.08)',
          }}
        />
      )}
      {/* Current slide fades in with subtle Ken Burns zoom */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${GYM_SLIDES[current]})`,
          opacity: fading ? 1 : 1,
          transition: `opacity ${FADE_DURATION}ms ease-in-out`,
          transform: 'scale(1.05)',
          animation: `kenburns ${(SLIDE_DURATION + FADE_DURATION) / 1000}s ease-out forwards`,
        }}
      />
      <style>{`
        @keyframes kenburns {
          from { transform: scale(1.05); }
          to   { transform: scale(1.12); }
        }
      `}</style>
    </>
  )
}

export function AuthLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const facilityName = useUIStore(s => s.facilityName) || 'Stay Fit'
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: gym branding ── */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col relative overflow-hidden"
        style={{ background: '#0f1729' }}
      >
        {/* Slideshow */}
        <GymSlideshow />

        {/* Dark overlay — text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,41,0.82) 0%, rgba(26,39,68,0.75) 50%, rgba(15,23,41,0.85) 100%)',
          }}
        />

        {/* Orange glow accent */}
        <div
          className="absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.25), transparent)' }}
        />

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="mb-auto">
            <div className="inline-flex items-center rounded-2xl bg-white px-5 py-3 shadow-lg">
              <img src="/logo.png" alt="Stay Fit Health Club" className="h-10 w-auto" />
            </div>
          </div>

          {/* Hero text */}
          <div className="py-16">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-semibold tracking-wide uppercase"
              style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
            >
              <Zap className="h-3 w-3" />
              Gym Management System
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-4">
              Run your gym<br />
              <span style={{ color: '#f97316' }}>smarter</span>, not harder.
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed max-w-md">
              Everything you need to manage members, trainers, classes, and revenue — all in one powerful dashboard.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-4 mb-12">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-orange-400"
                  style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}
                >
                  {f.icon}
                </div>
                <span className="text-slate-300 text-sm">{f.text}</span>
              </li>
            ))}
          </ul>

          {/* Stats */}
          <div
            className="grid grid-cols-3 gap-6 pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white dark:bg-slate-950 px-6 sm:px-12 lg:px-16 py-12">
        {/* Logo above form — shown on all screen sizes */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Stay Fit Health Club" className="h-14 w-auto" />
        </div>

        <div className="w-full max-w-sm">
          <Outlet />
        </div>

        <p className="mt-10 text-xs text-slate-400 text-center">
          © {new Date().getFullYear()} {facilityName}. All rights reserved.
        </p>
      </div>
    </div>
  )
}
