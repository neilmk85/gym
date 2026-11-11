import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffApi, type Staff } from '@/api/staff.api'
import { staffAttendanceApi, type SalarySlip } from '@/api/staff-attendance.api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Wallet, ChevronLeft, ChevronRight, FileText, CheckCircle, Banknote,
  Users, TrendingUp, AlertCircle, Download, RefreshCw, X, IndianRupee,
  History, Printer, ChevronDown,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const STATUS_CFG: Record<string, { label: string; cls: string; bg: string }> = {
  draft:     { label: 'Draft',     cls: 'text-amber-700',  bg: 'bg-amber-50' },
  finalized: { label: 'Finalized', cls: 'text-blue-700',   bg: 'bg-blue-50' },
  paid:      { label: 'Paid',      cls: 'text-green-700',  bg: 'bg-green-50' },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.draft
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${c.bg} ${c.cls}`}>
      {c.label}
    </span>
  )
}

type SlipModal = { slip: SalarySlip; staff: Staff } | null
type Tab = 'monthly' | 'history'

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function printSlip(slip: SalarySlip, staff: Staff) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Salary Slip - ${staff.first_name} ${staff.last_name} - ${MONTH_NAMES[slip.month]} ${slip.year}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; color: #1e293b; }
  .header { background: linear-gradient(135deg, #7c3aed, #9333ea); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
  .header h2 { margin: 0 0 4px; font-size: 20px; }
  .header p { margin: 0; opacity: 0.8; font-size: 13px; }
  .emp-row { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .body { border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px; }
  .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
  .att-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; text-align: center; margin-bottom: 20px; }
  .att-cell { background: #f8fafc; border-radius: 8px; padding: 8px 4px; }
  .att-cell .val { font-size: 18px; font-weight: 700; }
  .att-cell .lbl { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
  .row:last-child { border-bottom: none; }
  .total-row { display: flex; justify-content: space-between; padding: 10px 0 0; font-size: 16px; font-weight: 700; border-top: 2px solid #e2e8f0; margin-top: 4px; color: #7c3aed; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #15803d; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<div class="header">
  <h2>Salary Slip</h2>
  <p>${MONTH_NAMES[slip.month]} ${slip.year}</p>
  <div class="emp-row">
    <div>
      <div style="font-weight:600;font-size:16px">${staff.first_name} ${staff.last_name}</div>
      <div style="opacity:0.75;font-size:13px">${staff.employee_id} · ${staff.designation}</div>
    </div>
    <span class="badge">${slip.status.charAt(0).toUpperCase() + slip.status.slice(1)}</span>
  </div>
</div>
<div class="body">
  <div class="section-title">Attendance</div>
  <div class="att-grid">
    <div class="att-cell"><div class="val">${slip.working_days}</div><div class="lbl">Working Days</div></div>
    <div class="att-cell"><div class="val" style="color:#15803d">${slip.present_days}</div><div class="lbl">Present</div></div>
    <div class="att-cell"><div class="val" style="color:#b45309">${slip.half_days}</div><div class="lbl">Half Day</div></div>
    <div class="att-cell"><div class="val" style="color:#1d4ed8">${slip.leave_days}</div><div class="lbl">Leave</div></div>
    <div class="att-cell"><div class="val" style="color:#dc2626">${slip.absent_days}</div><div class="lbl">Absent</div></div>
  </div>
  <div class="section-title">Earnings &amp; Deductions</div>
  <div class="row"><span>Base Salary</span><span>₹${slip.base_salary.toLocaleString('en-IN')}</span></div>
  <div class="row"><span>Earned Salary</span><span style="color:#15803d">₹${slip.earned_salary.toLocaleString('en-IN')}</span></div>
  ${slip.bonus > 0 ? `<div class="row"><span>Bonus</span><span style="color:#15803d">+₹${slip.bonus.toLocaleString('en-IN')}</span></div>` : ''}
  ${slip.deductions > 0 ? `<div class="row"><span>Deductions</span><span style="color:#dc2626">−₹${slip.deductions.toLocaleString('en-IN')}</span></div>` : ''}
  <div class="total-row"><span>Net Salary</span><span>₹${slip.net_salary.toLocaleString('en-IN')}</span></div>
  ${slip.notes ? `<p style="font-size:12px;color:#94a3b8;margin-top:16px"><strong>Notes:</strong> ${slip.notes}</p>` : ''}
  <p style="font-size:11px;color:#cbd5e1;margin-top:20px;text-align:center">
    ${slip.paid_at ? `Paid on ${new Date(slip.paid_at).toLocaleDateString('en-IN')}` : `Generated on ${new Date(slip.created_at).toLocaleDateString('en-IN')}`}
  </p>
</div>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close() }<\/script>
</body></html>`
  const w = window.open('', '_blank', 'width=700,height=800')
  if (w) { w.document.write(html); w.document.close() }
}

export default function StaffPayrollPage() {
  const qc = useQueryClient()
  const today = new Date()
  const [tab, setTab] = useState<Tab>('monthly')
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [modal, setModal] = useState<SlipModal>(null)
  const [generating, setGenerating] = useState<number | null>(null)
  const [historyStaffId, setHistoryStaffId] = useState<number | null>(null)

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ per_page: 500, status: 'active' }),
  })
  const allStaff: Staff[] = useMemo(() => staffData?.data ?? [], [staffData])

  const { data: slips = [], isLoading } = useQuery({
    queryKey: ['salary-slips', month, year],
    queryFn: () => staffAttendanceApi.listSalarySlips(month, year),
  })

  const { data: staffHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['salary-slips-history', historyStaffId],
    queryFn: () => staffAttendanceApi.listSlipsByStaff(historyStaffId!),
    enabled: !!historyStaffId,
  })

  const slipByStaff = useMemo(() => {
    const map = new Map<number, SalarySlip>()
    slips.forEach((s: SalarySlip) => map.set(s.staff_id, s))
    return map
  }, [slips])

  const summary = useMemo(() => ({
    total: slips.length,
    paid: slips.filter((s: SalarySlip) => s.status === 'paid').length,
    finalized: slips.filter((s: SalarySlip) => s.status === 'finalized').length,
    draft: slips.filter((s: SalarySlip) => s.status === 'draft').length,
    totalNet: slips.reduce((acc: number, s: SalarySlip) => acc + s.net_salary, 0),
    paidNet: slips.filter((s: SalarySlip) => s.status === 'paid').reduce((acc: number, s: SalarySlip) => acc + s.net_salary, 0),
  }), [slips])

  const generateMutation = useMutation({
    mutationFn: ({ staffId }: { staffId: number }) =>
      staffAttendanceApi.generateSalarySlip(staffId, month, year),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-slips', month, year] })
      setGenerating(null)
      toast.success('Salary slip generated')
    },
    onError: () => { setGenerating(null); toast.error('Failed to generate slip') },
  })

  const statusMutation = useMutation({
    mutationFn: ({ slipId, status }: { slipId: number; status: 'draft' | 'finalized' | 'paid' }) =>
      staffAttendanceApi.updateSlipStatus(slipId, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['salary-slips', month, year] })
      if (historyStaffId) qc.invalidateQueries({ queryKey: ['salary-slips-history', historyStaffId] })
      toast.success(`Slip ${vars.status === 'paid' ? 'marked as paid' : vars.status === 'finalized' ? 'finalized' : 'reverted to draft'}`)
      setModal(null)
    },
    onError: () => toast.error('Failed to update slip status'),
  })

  const generateAll = async () => {
    const toGenerate = allStaff.filter(s => !slipByStaff.has(s.id))
    if (toGenerate.length === 0) {
      toast.info('All slips already generated for this month')
      return
    }
    for (const s of toGenerate) {
      setGenerating(s.id)
      await staffAttendanceApi.generateSalarySlip(s.id, month, year)
    }
    qc.invalidateQueries({ queryKey: ['salary-slips', month, year] })
    setGenerating(null)
    toast.success(`Generated ${toGenerate.length} salary slips`)
  }

  const exportMonthlyCSV = () => {
    const rows: string[][] = [
      ['Employee ID', 'Name', 'Department', 'Designation', 'Working Days', 'Present', 'Half Day',
       'Leave', 'Absent', 'Base Salary', 'Earned Salary', 'Bonus', 'Deductions', 'Net Salary', 'Status', 'Paid At'],
    ]
    allStaff.forEach(s => {
      const slip = slipByStaff.get(s.id)
      if (slip) {
        rows.push([
          s.employee_id, `${s.first_name} ${s.last_name}`, s.department, s.designation,
          String(slip.working_days), String(slip.present_days), String(slip.half_days),
          String(slip.leave_days), String(slip.absent_days),
          String(slip.base_salary), String(slip.earned_salary), String(slip.bonus),
          String(slip.deductions), String(slip.net_salary),
          slip.status, slip.paid_at ? new Date(slip.paid_at).toLocaleDateString('en-IN') : '',
        ])
      }
    })
    downloadCSV(`payroll-${MONTH_NAMES[month]}-${year}.csv`, rows)
  }

  const exportHistoryCSV = () => {
    if (!historyStaff || staffHistory.length === 0) return
    const rows: string[][] = [
      ['Month', 'Year', 'Working Days', 'Present', 'Half Day', 'Leave', 'Absent',
       'Base Salary', 'Earned Salary', 'Bonus', 'Deductions', 'Net Salary', 'Status', 'Paid At'],
    ]
    staffHistory.forEach((slip: SalarySlip) => {
      rows.push([
        MONTH_NAMES[slip.month], String(slip.year), String(slip.working_days),
        String(slip.present_days), String(slip.half_days), String(slip.leave_days), String(slip.absent_days),
        String(slip.base_salary), String(slip.earned_salary), String(slip.bonus),
        String(slip.deductions), String(slip.net_salary),
        slip.status, slip.paid_at ? new Date(slip.paid_at).toLocaleDateString('en-IN') : '',
      ])
    })
    downloadCSV(`payroll-history-${historyStaff.first_name}-${historyStaff.last_name}.csv`, rows)
  }

  const historyStaff = allStaff.find(s => s.id === historyStaffId)
  const historyTotalPaid = staffHistory.filter((s: SalarySlip) => s.status === 'paid').reduce((a: number, s: SalarySlip) => a + s.net_salary, 0)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Staff Payroll</h1>
            <p className="text-sm text-slate-500">Generate and manage monthly salary slips</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('monthly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'monthly'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Monthly</span>
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'history'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Payout History</span>
          </button>
        </div>
      </div>

      {/* ── MONTHLY TAB ── */}
      {tab === 'monthly' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
              <span className="font-semibold text-slate-700 min-w-[160px] text-center">{MONTH_NAMES[month]} {year}</span>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={generateAll} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Generate All
              </Button>
              <Button onClick={exportMonthlyCSV} variant="outline" size="sm" className="gap-2" disabled={slips.length === 0}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Staff', value: allStaff.length, icon: <Users className="h-5 w-5 text-slate-500" />, color: 'bg-slate-50' },
              { label: 'Slips Generated', value: `${slips.length}/${allStaff.length}`, icon: <FileText className="h-5 w-5 text-amber-500" />, color: 'bg-amber-50' },
              { label: 'Total Payroll', value: formatCurrency(summary.totalNet), icon: <IndianRupee className="h-5 w-5 text-violet-500" />, color: 'bg-violet-50' },
              { label: 'Paid Out', value: formatCurrency(summary.paidNet), icon: <Banknote className="h-5 w-5 text-green-500" />, color: 'bg-green-50' },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3">
                  <div className={`inline-flex p-2 rounded-lg ${s.color} mb-2`}>{s.icon}</div>
                  <div className="text-xl font-bold text-slate-900">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Staff Payroll Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                {MONTH_NAMES[month]} {year} — Salary Slips
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : allStaff.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No active staff found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">Employee</th>
                        <th className="text-center px-4 py-3 font-semibold">Working Days</th>
                        <th className="text-center px-4 py-3 font-semibold">Present</th>
                        <th className="text-center px-4 py-3 font-semibold">Absent</th>
                        <th className="text-right px-4 py-3 font-semibold">Base Salary</th>
                        <th className="text-right px-4 py-3 font-semibold">Earned</th>
                        <th className="text-right px-4 py-3 font-semibold">Net Salary</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                        <th className="text-center px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allStaff.map(s => {
                        const slip = slipByStaff.get(s.id)
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                  {s.first_name[0]}{s.last_name[0]}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900">{s.first_name} {s.last_name}</div>
                                  <div className="text-xs text-slate-400">{s.employee_id} · {s.department}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm">{slip ? slip.working_days : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {slip ? (
                                <span className="text-sm text-green-700 font-medium">{slip.present_days + (slip.half_days * 0.5)}</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {slip ? (
                                <span className={`text-sm font-medium ${slip.absent_days > 0 ? 'text-red-600' : 'text-slate-400'}`}>{slip.absent_days}</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-sm">{formatCurrency(s.salary)}</td>
                            <td className="px-4 py-3 text-right text-sm">{slip ? formatCurrency(slip.earned_salary) : '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{slip ? formatCurrency(slip.net_salary) : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {slip ? <StatusBadge status={slip.status} /> : <span className="text-xs text-slate-300">Not generated</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {!slip ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 gap-1"
                                    loading={generating === s.id}
                                    onClick={() => { setGenerating(s.id); generateMutation.mutate({ staffId: s.id }) }}
                                  >
                                    <FileText className="h-3 w-3" />
                                    Generate
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-7 px-2 text-violet-600 hover:text-violet-700"
                                    onClick={() => setModal({ slip, staff: s })}
                                  >
                                    View
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="space-y-5">
          {/* Staff Selector */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Select Staff Member</label>
                  <div className="relative">
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={historyStaffId ?? ''}
                      onChange={e => setHistoryStaffId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Choose a staff member —</option>
                      {allStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.employee_id})</option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
                {historyStaffId && staffHistory.length > 0 && (
                  <Button onClick={exportHistoryCSV} variant="outline" size="sm" className="gap-2 self-end">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* History Stats */}
          {historyStaff && staffHistory.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Slips', value: staffHistory.length, color: 'bg-slate-50', icon: <FileText className="h-5 w-5 text-slate-500" /> },
                { label: 'Paid Slips', value: staffHistory.filter((s: SalarySlip) => s.status === 'paid').length, color: 'bg-green-50', icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
                { label: 'Total Paid Out', value: formatCurrency(historyTotalPaid), color: 'bg-violet-50', icon: <IndianRupee className="h-5 w-5 text-violet-500" /> },
                { label: 'Avg Net Salary', value: formatCurrency(staffHistory.reduce((a: number, s: SalarySlip) => a + s.net_salary, 0) / staffHistory.length), color: 'bg-amber-50', icon: <TrendingUp className="h-5 w-5 text-amber-500" /> },
              ].map((stat, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-3">
                    <div className={`inline-flex p-2 rounded-lg ${stat.color} mb-2`}>{stat.icon}</div>
                    <div className="text-xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* History Table */}
          {!historyStaffId ? (
            <div className="text-center py-16 text-slate-400">
              <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a staff member to view their payout history</p>
            </div>
          ) : historyLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : staffHistory.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No salary slips found for {historyStaff?.first_name} {historyStaff?.last_name}</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="h-4 w-4 text-violet-600" />
                  {historyStaff?.first_name} {historyStaff?.last_name} — All Salary Slips
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">Month / Year</th>
                        <th className="text-center px-4 py-3 font-semibold">Days</th>
                        <th className="text-center px-4 py-3 font-semibold">Present</th>
                        <th className="text-center px-4 py-3 font-semibold">Absent</th>
                        <th className="text-right px-4 py-3 font-semibold">Base</th>
                        <th className="text-right px-4 py-3 font-semibold">Net Salary</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                        <th className="text-center px-4 py-3 font-semibold">Paid On</th>
                        <th className="text-center px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffHistory.map((slip: SalarySlip) => (
                        <tr key={slip.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {MONTH_NAMES[slip.month]} {slip.year}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-600">{slip.working_days}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-green-700 font-medium">{slip.present_days + slip.half_days * 0.5}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-medium ${slip.absent_days > 0 ? 'text-red-600' : 'text-slate-400'}`}>{slip.absent_days}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(slip.base_salary)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(slip.net_salary)}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={slip.status} /></td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500">
                            {slip.paid_at ? new Date(slip.paid_at).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 px-2 text-violet-600 hover:text-violet-700"
                                onClick={() => historyStaff && setModal({ slip, staff: historyStaff })}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 px-2 text-slate-500 hover:text-slate-700"
                                onClick={() => historyStaff && printSlip(slip, historyStaff)}
                                title="Print slip"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Salary Slip Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Slip Header */}
            <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-6 py-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium opacity-75 uppercase tracking-widest mb-1">Salary Slip</div>
                  <div className="text-xl font-bold">{MONTH_NAMES[modal.slip.month]} {modal.slip.year}</div>
                </div>
                <button onClick={() => setModal(null)} className="text-white/70 hover:text-white p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                  {modal.staff.first_name[0]}{modal.staff.last_name[0]}
                </div>
                <div>
                  <div className="font-semibold">{modal.staff.first_name} {modal.staff.last_name}</div>
                  <div className="text-xs opacity-75">{modal.staff.employee_id} · {modal.staff.designation}</div>
                </div>
                <div className="ml-auto">
                  <StatusBadge status={modal.slip.status} />
                </div>
              </div>
            </div>

            {/* Slip Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Attendance breakdown */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attendance</div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: 'Working Days', value: modal.slip.working_days, color: 'text-slate-700' },
                    { label: 'Present', value: modal.slip.present_days, color: 'text-green-700' },
                    { label: 'Half Day', value: modal.slip.half_days, color: 'text-amber-700' },
                    { label: 'Leave', value: modal.slip.leave_days, color: 'text-blue-700' },
                    { label: 'Absent', value: modal.slip.absent_days, color: 'text-red-600' },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg py-2 px-1">
                      <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-tight">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Earnings breakdown */}
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Earnings &amp; Deductions</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Base Salary</span>
                    <span className="font-medium">{formatCurrency(modal.slip.base_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Earned Salary</span>
                    <span className="font-medium text-green-700">{formatCurrency(modal.slip.earned_salary)}</span>
                  </div>
                  {modal.slip.bonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bonus</span>
                      <span className="font-medium text-green-600">+{formatCurrency(modal.slip.bonus)}</span>
                    </div>
                  )}
                  {modal.slip.deductions > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Deductions</span>
                      <span className="font-medium text-red-600">−{formatCurrency(modal.slip.deductions)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t font-bold text-base">
                    <span>Net Salary</span>
                    <span className="text-violet-700">{formatCurrency(modal.slip.net_salary)}</span>
                  </div>
                </div>
              </div>

              {modal.slip.notes && (
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                  <span className="font-medium">Notes: </span>{modal.slip.notes}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex items-center justify-between gap-3 border-t pt-4">
              <div className="text-xs text-slate-400">
                {modal.slip.paid_at
                  ? `Paid on ${new Date(modal.slip.paid_at).toLocaleDateString('en-IN')}`
                  : `Generated ${new Date(modal.slip.created_at).toLocaleDateString('en-IN')}`}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-slate-600 gap-1.5"
                  onClick={() => printSlip(modal.slip, modal.staff)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
                {modal.slip.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => statusMutation.mutate({ slipId: modal.slip.id, status: 'finalized' })}
                    loading={statusMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Finalize
                  </Button>
                )}
                {modal.slip.status === 'finalized' && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => statusMutation.mutate({ slipId: modal.slip.id, status: 'paid' })}
                    loading={statusMutation.isPending}
                  >
                    <Banknote className="h-4 w-4 mr-1" />
                    Mark as Paid
                  </Button>
                )}
                {modal.slip.status === 'paid' && (
                  <span className="inline-flex items-center gap-1.5 text-green-700 text-sm font-medium">
                    <CheckCircle className="h-4 w-4" /> Paid
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
