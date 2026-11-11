export interface StaffMember {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  secondary_phone?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  department: string
  designation: string
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern'
  date_of_joining: string
  reporting_to?: string
  salary: number
  pan_number?: string
  aadhar_number?: string
  status: 'active' | 'inactive' | 'on_leave' | 'resigned'
  notes?: string
  created_at: string
}

const KEY = 'gym_staff_v1'

export const DEPARTMENTS = [
  'Reception', 'Accounts', 'HR', 'Housekeeping', 'Security',
  'Maintenance', 'Marketing', 'IT', 'Management', 'Other',
]

export const EMPLOYMENT_TYPES: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
}

export const ID_TYPES: Record<string, string> = {
  aadhar: 'Aadhar',
  pan: 'PAN',
  passport: 'Passport',
  driving_license: 'Driving License',
}

export const STAFF_STATUSES: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_leave: 'On Leave',
  resigned: 'Resigned',
}

export function loadStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as StaffMember[]
  } catch { /* ignore */ }
  return []
}

export function saveStaff(list: StaffMember[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addStaff(data: Omit<StaffMember, 'id' | 'employee_id' | 'created_at'>): StaffMember {
  const list = loadStaff()
  const maxNum = list.reduce((max, s) => {
    const n = parseInt(s.employee_id.replace('EMP', ''), 10)
    return isNaN(n) ? max : Math.max(max, n)
  }, 0)
  const employee_id = 'EMP' + String(maxNum + 1).padStart(3, '0')
  const member: StaffMember = {
    ...data,
    id: crypto.randomUUID(),
    employee_id,
    created_at: new Date().toISOString(),
  }
  saveStaff([...list, member])
  return member
}

export function updateStaff(id: string, data: Partial<StaffMember>): void {
  const list = loadStaff()
  saveStaff(list.map(s => s.id === id ? { ...s, ...data } : s))
}

export function deleteStaff(id: string): void {
  saveStaff(loadStaff().filter(s => s.id !== id))
}

// Seed sample data on first load
;(function seedStaff() {
  try {
    if (localStorage.getItem(KEY)) return
    const seed: Omit<StaffMember, 'id' | 'employee_id' | 'created_at'>[] = [
      { first_name: 'Rahul',  last_name: 'Sharma', email: 'rahul.sharma@gym.com',  phone: '9811001100', department: 'Reception',    designation: 'Receptionist',      employment_type: 'full_time', date_of_joining: '2023-01-15', salary: 18000, status: 'active' },
      { first_name: 'Priya',  last_name: 'Patel',  email: 'priya.patel@gym.com',   phone: '9811001101', department: 'Accounts',     designation: 'Accountant',        employment_type: 'full_time', date_of_joining: '2022-06-01', salary: 25000, status: 'active' },
      { first_name: 'Suresh', last_name: 'Kumar',  email: 'suresh.kumar@gym.com',  phone: '9811001102', department: 'Housekeeping', designation: 'Housekeeping Staff',employment_type: 'full_time', date_of_joining: '2023-03-10', salary: 15000, status: 'active' },
      { first_name: 'Deepa',  last_name: 'Nair',   email: 'deepa.nair@gym.com',    phone: '9811001103', department: 'HR',           designation: 'HR Manager',        employment_type: 'full_time', date_of_joining: '2021-09-01', salary: 35000, status: 'active' },
      { first_name: 'Ravi',   last_name: 'Singh',  email: 'ravi.singh@gym.com',    phone: '9811001104', department: 'Security',     designation: 'Security Guard',    employment_type: 'full_time', date_of_joining: '2022-11-20', salary: 16000, status: 'active' },
    ]
    const list: StaffMember[] = seed.map((s, i) => ({
      ...s,
      id: crypto.randomUUID(),
      employee_id: 'EMP' + String(i + 1).padStart(3, '0'),
      created_at: new Date().toISOString(),
    }))
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch { /* ignore */ }
})()
