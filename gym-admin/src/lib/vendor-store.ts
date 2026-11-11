export type VendorStatus = 'active' | 'inactive'

export interface Vendor {
  id: string
  name: string
  contact_name?: string
  phone: string
  email?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gst_number?: string
  pan_number?: string
  category: string
  payment_terms?: string
  credit_limit?: number
  bank_name?: string
  bank_account?: string
  bank_ifsc?: string
  status: VendorStatus
  notes?: string
  created_at: string
}

export const VENDOR_CATEGORIES = [
  'Equipment', 'Supplements', 'Maintenance', 'Cleaning', 'Stationery',
  'IT & Tech', 'Food & Beverage', 'Uniforms', 'Marketing', 'Other',
]

export const PAYMENT_TERMS = [
  'Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance',
]

const KEY = 'gym_vendors_v1'

export function loadVendors(): Vendor[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Vendor[]
  } catch { /* ignore */ }
  return []
}

export function saveVendors(list: Vendor[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addVendor(data: Omit<Vendor, 'id' | 'created_at'>): Vendor {
  const list = loadVendors()
  const vendor: Vendor = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
  saveVendors([...list, vendor])
  return vendor
}

export function updateVendor(id: string, data: Partial<Vendor>): void {
  saveVendors(loadVendors().map(v => v.id === id ? { ...v, ...data } : v))
}

export function deleteVendor(id: string): void {
  saveVendors(loadVendors().filter(v => v.id !== id))
}

;(function seedVendors() {
  try {
    if (localStorage.getItem(KEY)) return
    const seed: Omit<Vendor, 'id' | 'created_at'>[] = [
      { name: 'Kore Fitness Pvt Ltd',   contact_name: 'Rajesh Gupta',  phone: '9811001200', email: 'sales@korefitness.com',  category: 'Equipment',    payment_terms: 'Net 30', city: 'Delhi',   gst_number: '07AABCK1234A1Z5', status: 'active' },
      { name: 'MuscleBlaze India',       contact_name: 'Priya Mehta',   phone: '9811001201', email: 'b2b@muscleblaze.com',    category: 'Supplements',  payment_terms: 'Net 15', city: 'Noida',   gst_number: '09AABCM5678B1Z2', status: 'active' },
      { name: 'Hindustan Unilever Ltd',  contact_name: 'Suresh Rao',    phone: '9811001202', email: 'trade@hul.com',          category: 'Cleaning',     payment_terms: 'Net 30', city: 'Mumbai',  gst_number: '27AABCH9012C1Z8', status: 'active' },
      { name: 'Rogue Equipment India',   contact_name: 'Deepa Sharma',  phone: '9811001203', email: 'india@rogueequipment.com', category: 'Equipment', payment_terms: 'Advance', city: 'Bengaluru', gst_number: '29AABCR3456D1Z4', status: 'active' },
      { name: 'Office Depot India',      contact_name: 'Ravi Pillai',   phone: '9811001204', email: 'orders@officedepot.in',  category: 'Stationery',   payment_terms: 'Net 7',  city: 'Chennai', gst_number: '33AABCO7890E1Z1', status: 'active' },
    ]
    const list: Vendor[] = seed.map(s => ({ ...s, id: crypto.randomUUID(), created_at: new Date().toISOString() }))
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch { /* ignore */ }
})()
