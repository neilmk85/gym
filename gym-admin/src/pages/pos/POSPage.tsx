import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { posApi, type Product } from '@/api/pos.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import {
  Search, Plus, Minus, Trash2, AlertTriangle, ShoppingCart,
  Banknote, CreditCard, Smartphone, Building2, Package,
} from 'lucide-react'
import { toast } from 'sonner'

type CartItem = { product: Product; qty: number }

const CATEGORIES = ['All', 'supplements', 'apparel', 'equipment', 'other']

const PAYMENT_METHODS = [
  { key: 'cash',        label: 'Cash',        icon: Banknote },
  { key: 'upi',         label: 'UPI',         icon: Smartphone },
  { key: 'card',        label: 'Card',        icon: CreditCard },
  { key: 'net_banking', label: 'Net Banking', icon: Building2 },
]

function pToRs(paise: number) { return paise / 100 }
function rsToPaise(rs: number) { return Math.round(rs * 100) }

export default function POSPage() {
  const qc = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountRs, setDiscountRs] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [memberIdInput, setMemberIdInput] = useState('')
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [form, setForm] = useState({ name: '', sku: '', category: '', price: '', stock_qty: '', low_stock_at: '5' })

  // Auto-focus search on load
  useEffect(() => { searchRef.current?.focus() }, [])

  const { data: productsData } = useQuery({
    queryKey: ['pos-products', search, category === 'All' ? '' : category],
    queryFn: () => posApi.listProducts(1, 100, search, category === 'All' ? '' : category),
  })
  const products: Product[] = productsData?.data ?? []

  const createProductMutation = useMutation({
    mutationFn: () => posApi.createProduct({
      name: form.name,
      sku: form.sku || undefined,
      category: form.category || undefined,
      price_paise: rsToPaise(Number(form.price)),
      stock_qty: Number(form.stock_qty) || 0,
      low_stock_at: Number(form.low_stock_at) || 5,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-products'] })
      setAddProductOpen(false)
      setForm({ name: '', sku: '', category: '', price: '', stock_qty: '', low_stock_at: '5' })
      toast.success('Product added')
    },
    onError: () => toast.error('Failed to create product'),
  })

  const checkoutMutation = useMutation({
    mutationFn: () => posApi.createOrder({
      items: cart.map(c => ({ product_id: c.product.id, qty: c.qty })),
      payment_mode: paymentMode,
      discount_paise: rsToPaise(Number(discountRs) || 0),
      member_id: memberIdInput ? Number(memberIdInput) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-products'] })
      setCart([])
      setDiscountRs('')
      setMemberIdInput('')
      toast.success('Sale completed!')
      searchRef.current?.focus()
    },
    onError: (err: any) => toast.error(err?.message ?? 'Checkout failed'),
  })

  // Cart helpers
  const addToCart = (product: Product) => {
    if (product.stock_qty === 0) return
    setCart(prev => {
      const ex = prev.find(x => x.product.id === product.id)
      if (ex) {
        if (ex.qty >= product.stock_qty) { toast.warning('No more stock'); return prev }
        return prev.map(x => x.product.id === product.id ? { ...x, qty: x.qty + 1 } : x)
      }
      return [...prev, { product, qty: 1 }]
    })
  }

  const setQty = (id: number, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(x => x.product.id !== id)); return }
    setCart(prev => prev.map(x => x.product.id === id ? { ...x, qty: Math.min(qty, x.product.stock_qty) } : x))
  }

  const removeFromCart = (id: number) => setCart(prev => prev.filter(x => x.product.id !== id))

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.product.price_paise * c.qty, 0)
  const discountPaise = rsToPaise(Math.max(0, Number(discountRs) || 0))
  const cappedDiscount = Math.min(discountPaise, subtotal)
  const total = subtotal - cappedDiscount

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── LEFT: Product catalogue ── */}
      <div className="flex-1 flex flex-col min-w-0 border-r">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b bg-background">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or scan barcode…"
              className="pl-9"
            />
          </div>
          <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1.5" />Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Protein Shake" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" /></div>
                  <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="supplements" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (₹) *</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" /></div>
                  <div><Label>Initial Stock</Label><Input type="number" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))} placeholder="0" /></div>
                </div>
                <div><Label>Low Stock Alert At</Label><Input type="number" value={form.low_stock_at} onChange={e => setForm(f => ({ ...f, low_stock_at: e.target.value }))} /></div>
                <Button
                  className="w-full"
                  onClick={() => createProductMutation.mutate()}
                  disabled={createProductMutation.isPending || !form.name || !form.price}
                >
                  {createProductMutation.isPending ? 'Saving…' : 'Create Product'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 px-5 py-2 border-b overflow-x-auto shrink-0">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-3 py-1 rounded-full border font-medium whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-input hover:border-primary/50'
              }`}
            >
              {cat === 'All' ? 'All Products' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <Package className="h-8 w-8" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {products.map(p => {
                const inCart = cart.find(c => c.product.id === p.id)
                const lowStock = p.stock_qty <= p.low_stock_at
                const outOfStock = p.stock_qty === 0
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={outOfStock}
                    className={`text-left rounded-lg border p-3.5 transition-all ${
                      outOfStock
                        ? 'opacity-40 cursor-not-allowed bg-muted/30'
                        : inCart
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'bg-card hover:border-primary/60 hover:shadow-sm active:scale-[0.98]'
                    } ${lowStock && !outOfStock ? 'border-orange-300' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <p className="font-medium text-sm leading-tight line-clamp-2">{p.name}</p>
                      {inCart && (
                        <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          {inCart.qty}
                        </span>
                      )}
                    </div>
                    {p.category && <p className="text-[10px] text-muted-foreground capitalize mb-1.5">{p.category}</p>}
                    <div className="flex items-center justify-between mt-auto">
                      <div>
                        <p className="font-bold text-base leading-tight">{formatCurrency(pToRs(p.price_paise))}</p>
                        {p.mrp_paise > p.price_paise && (
                          <p className="text-[10px] text-muted-foreground line-through leading-tight">
                            MRP {formatCurrency(pToRs(p.mrp_paise))}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] flex items-center gap-0.5 ${lowStock ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        {lowStock && <AlertTriangle className="h-2.5 w-2.5" />}
                        {outOfStock ? 'Out of stock' : `${p.stock_qty} left`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart + billing ── */}
      <div className="w-[380px] shrink-0 flex flex-col bg-muted/20">
        {/* Cart header */}
        <div className="px-5 py-3 border-b flex items-center gap-2 bg-background">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Cart</span>
          {cart.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{cart.reduce((s, c) => s + c.qty, 0)} items</Badge>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <ShoppingCart className="h-6 w-6 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Click a product to add</p>
            </div>
          ) : (
            cart.map(c => (
              <div key={c.product.id} className="bg-background rounded-lg border px-3 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.product.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(pToRs(c.product.price_paise))} each</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setQty(c.product.id, c.qty - 1)}
                    className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    value={c.qty}
                    min={1}
                    max={c.product.stock_qty}
                    onChange={e => setQty(c.product.id, Number(e.target.value))}
                    className="w-9 text-center text-sm border rounded py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setQty(c.product.id, c.qty + 1)}
                    className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted transition-colors"
                    disabled={c.qty >= c.product.stock_qty}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button onClick={() => removeFromCart(c.product.id)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm font-semibold w-16 text-right shrink-0">
                  {formatCurrency(pToRs(c.product.price_paise * c.qty))}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Billing summary */}
        <div className="border-t bg-background px-5 pt-4 pb-5 space-y-4">
          {/* Subtotal / Discount / Total */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(pToRs(subtotal))}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Discount (₹)</span>
              <input
                type="number"
                min="0"
                value={discountRs}
                onChange={e => setDiscountRs(e.target.value)}
                placeholder="0"
                className="ml-auto w-24 text-right text-sm border rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {cappedDiscount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount applied</span>
                <span>- {formatCurrency(pToRs(cappedDiscount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-1">
              <span>Total</span>
              <span>{formatCurrency(pToRs(total))}</span>
            </div>
          </div>

          {/* Payment methods */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPaymentMode(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    paymentMode === key
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-input bg-background hover:border-primary/60 text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Member ID */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Member ID</Label>
            <Input
              type="number"
              value={memberIdInput}
              onChange={e => setMemberIdInput(e.target.value)}
              placeholder="Optional"
              className="h-8 text-sm"
            />
          </div>

          {/* Checkout */}
          <Button
            className="w-full h-11 text-base font-semibold"
            disabled={cart.length === 0 || checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending ? 'Processing…' : `Charge ${formatCurrency(pToRs(total))}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
