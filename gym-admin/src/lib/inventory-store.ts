export type EquipmentCategory = 'Machine' | 'Dumbbell' | 'Plate' | 'Barbell' | 'Kettlebell' | 'Bench' | 'Cable & Attachment' | 'Other'
export type EquipmentCondition = 'good' | 'fair' | 'needs_repair' | 'retired'

export interface EquipmentItem {
  id: string
  name: string
  brand: string
  category: EquipmentCategory
  quantity: number
  weight_kg?: number      // for dumbbells, plates, barbells, kettlebells
  unit: 'pcs' | 'pairs' | 'kg' | 'sets'
  condition: EquipmentCondition
  location?: string
  serial_number?: string
  purchased_at?: string
  notes?: string
  created_at: string
}

export const CATEGORIES: EquipmentCategory[] = [
  'Machine', 'Dumbbell', 'Plate', 'Barbell', 'Kettlebell', 'Bench', 'Cable & Attachment', 'Other',
]

export const CONDITIONS: Record<EquipmentCondition, string> = {
  good:         'Good',
  fair:         'Fair',
  needs_repair: 'Needs Repair',
  retired:      'Retired',
}

const KEY = 'gym_inventory_v1'

export function loadInventory(): EquipmentItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as EquipmentItem[]
  } catch { /* ignore */ }
  return []
}

export function saveInventory(list: EquipmentItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addEquipment(data: Omit<EquipmentItem, 'id' | 'created_at'>): EquipmentItem {
  const list = loadInventory()
  const item: EquipmentItem = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
  saveInventory([...list, item])
  return item
}

export function updateEquipment(id: string, data: Partial<EquipmentItem>): void {
  saveInventory(loadInventory().map(i => i.id === id ? { ...i, ...data } : i))
}

export function deleteEquipment(id: string): void {
  saveInventory(loadInventory().filter(i => i.id !== id))
}

;(function seedInventory() {
  try {
    if (localStorage.getItem(KEY)) return
    const seed: Omit<EquipmentItem, 'id' | 'created_at'>[] = [
      // Machines
      { name: 'Treadmill', brand: 'Precor', category: 'Machine', quantity: 5, unit: 'pcs', condition: 'good', location: 'Cardio Zone' },
      { name: 'Elliptical Trainer', brand: 'Life Fitness', category: 'Machine', quantity: 3, unit: 'pcs', condition: 'good', location: 'Cardio Zone' },
      { name: 'Stationary Bike', brand: 'Schwinn', category: 'Machine', quantity: 4, unit: 'pcs', condition: 'good', location: 'Cardio Zone' },
      { name: 'Leg Press Machine', brand: 'Cybex', category: 'Machine', quantity: 2, unit: 'pcs', condition: 'good', location: 'Strength Zone' },
      { name: 'Chest Press Machine', brand: 'Cybex', category: 'Machine', quantity: 2, unit: 'pcs', condition: 'fair', location: 'Strength Zone' },
      { name: 'Lat Pulldown Machine', brand: 'Life Fitness', category: 'Machine', quantity: 2, unit: 'pcs', condition: 'good', location: 'Strength Zone' },
      { name: 'Seated Row Machine', brand: 'Life Fitness', category: 'Machine', quantity: 1, unit: 'pcs', condition: 'good', location: 'Strength Zone' },
      { name: 'Smith Machine', brand: 'Body-Solid', category: 'Machine', quantity: 1, unit: 'pcs', condition: 'good', location: 'Free Weights' },
      // Dumbbells
      { name: 'Hex Dumbbell 2.5 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 2.5, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 5 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 5, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 7.5 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 7.5, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 10 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 10, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 12.5 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 12.5, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 15 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 15, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 20 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 20, unit: 'pairs', condition: 'fair', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 25 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 25, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      { name: 'Hex Dumbbell 30 kg', brand: 'Kore', category: 'Dumbbell', quantity: 2, weight_kg: 30, unit: 'pairs', condition: 'good', location: 'Dumbbell Rack' },
      // Plates
      { name: 'Iron Plate 1.25 kg', brand: 'RFX', category: 'Plate', quantity: 8, weight_kg: 1.25, unit: 'pcs', condition: 'good', location: 'Plate Tree' },
      { name: 'Iron Plate 2.5 kg', brand: 'RFX', category: 'Plate', quantity: 8, weight_kg: 2.5, unit: 'pcs', condition: 'good', location: 'Plate Tree' },
      { name: 'Iron Plate 5 kg', brand: 'RFX', category: 'Plate', quantity: 8, weight_kg: 5, unit: 'pcs', condition: 'good', location: 'Plate Tree' },
      { name: 'Iron Plate 10 kg', brand: 'RFX', category: 'Plate', quantity: 6, weight_kg: 10, unit: 'pcs', condition: 'good', location: 'Plate Tree' },
      { name: 'Iron Plate 20 kg', brand: 'RFX', category: 'Plate', quantity: 4, weight_kg: 20, unit: 'pcs', condition: 'fair', location: 'Plate Tree' },
      { name: 'Bumper Plate 10 kg', brand: 'Jordan Fitness', category: 'Plate', quantity: 4, weight_kg: 10, unit: 'pcs', condition: 'good', location: 'Lifting Platform' },
      { name: 'Bumper Plate 20 kg', brand: 'Jordan Fitness', category: 'Plate', quantity: 4, weight_kg: 20, unit: 'pcs', condition: 'good', location: 'Lifting Platform' },
      // Barbells
      { name: 'Olympic Barbell 20 kg', brand: 'Rogue', category: 'Barbell', quantity: 4, weight_kg: 20, unit: 'pcs', condition: 'good', location: 'Free Weights' },
      { name: 'EZ Curl Bar 10 kg', brand: 'Kore', category: 'Barbell', quantity: 3, weight_kg: 10, unit: 'pcs', condition: 'good', location: 'Free Weights' },
      { name: 'Trap/Hex Bar 25 kg', brand: 'Body-Solid', category: 'Barbell', quantity: 1, weight_kg: 25, unit: 'pcs', condition: 'good', location: 'Free Weights' },
      // Kettlebells
      { name: 'Kettlebell 8 kg', brand: 'Decathlon', category: 'Kettlebell', quantity: 3, weight_kg: 8, unit: 'pcs', condition: 'good', location: 'Functional Zone' },
      { name: 'Kettlebell 12 kg', brand: 'Decathlon', category: 'Kettlebell', quantity: 3, weight_kg: 12, unit: 'pcs', condition: 'good', location: 'Functional Zone' },
      { name: 'Kettlebell 16 kg', brand: 'Decathlon', category: 'Kettlebell', quantity: 2, weight_kg: 16, unit: 'pcs', condition: 'good', location: 'Functional Zone' },
      { name: 'Kettlebell 24 kg', brand: 'Decathlon', category: 'Kettlebell', quantity: 2, weight_kg: 24, unit: 'pcs', condition: 'good', location: 'Functional Zone' },
      // Benches
      { name: 'Flat Bench', brand: 'Body-Solid', category: 'Bench', quantity: 4, unit: 'pcs', condition: 'good', location: 'Free Weights' },
      { name: 'Adjustable FID Bench', brand: 'Body-Solid', category: 'Bench', quantity: 3, unit: 'pcs', condition: 'good', location: 'Free Weights' },
      { name: 'Incline Bench', brand: 'Life Fitness', category: 'Bench', quantity: 2, unit: 'pcs', condition: 'fair', location: 'Strength Zone' },
      // Cables
      { name: 'Rope Attachment', brand: 'ATX', category: 'Cable & Attachment', quantity: 4, unit: 'pcs', condition: 'good', location: 'Cable Station' },
      { name: 'Straight Bar', brand: 'ATX', category: 'Cable & Attachment', quantity: 3, unit: 'pcs', condition: 'good', location: 'Cable Station' },
      { name: 'V-Bar', brand: 'ATX', category: 'Cable & Attachment', quantity: 2, unit: 'pcs', condition: 'good', location: 'Cable Station' },
      { name: 'Ankle Strap', brand: 'ATX', category: 'Cable & Attachment', quantity: 4, unit: 'pcs', condition: 'good', location: 'Cable Station' },
    ]
    const list: EquipmentItem[] = seed.map(s => ({
      ...s,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    }))
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch { /* ignore */ }
})()
