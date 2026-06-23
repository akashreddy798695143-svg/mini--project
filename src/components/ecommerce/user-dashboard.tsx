'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Package, Heart, MapPin, Wallet, Tag, Star, Bell, Settings,
  LogOut, Edit, Trash2, Copy, ChevronRight, Plus, Minus, Truck,
  RotateCcw, X, Check, Eye
} from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useNavigationStore } from '@/store/navigation-store'
import { useWishlistStore } from '@/store/wishlist-store'
import { useCartStore } from '@/store/cart-store'
import { formatPrice } from '@/lib/mock-data'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

// ==================== API TYPES ====================
interface ApiOrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  salePrice: number | null
  total: number
  status: string
  product: {
    id: string
    name: string
    slug: string
    images: string
    basePrice: number
    salePrice: number | null
  }
}

interface ApiOrder {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  subtotal: number
  discount: number
  tax: number
  shipping: number
  total: number
  couponCode: string | null
  addressId: string
  notes: string | null
  trackingId: string | null
  trackingUrl: string | null
  estimatedDelivery: string | null
  deliveredAt: string | null
  createdAt: string
  items: ApiOrderItem[]
}

interface ApiAddress {
  id: string
  name: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  pincode: string
  country: string
  isDefault: boolean
  addressType: string
}

interface ApiNotification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  link: string | null
  image: string | null
  createdAt: string
}

interface ApiCoupon {
  id: string
  code: string
  description: string | null
  type: string
  value: number
  minOrder: number
  maxDiscount: number | null
  isActive: boolean
  startsAt: string
  expiresAt: string
}

// ==================== API HELPERS ====================
function parseImages(imagesJson: string | null | undefined): string[] {
  if (!imagesJson) return []
  try {
    const parsed = JSON.parse(imagesJson)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function capitalizeStatus(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function normalizeNotifType(type: string): 'Orders' | 'Promos' | 'System' {
  const t = (type || '').toLowerCase()
  if (t === 'order' || t === 'orders') return 'Orders'
  if (t === 'promo' || t === 'promos' || t === 'promotion') return 'Promos'
  return 'System'
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const diffMs = Date.now() - date.getTime()
    const sec = Math.floor(diffMs / 1000)
    if (sec < 60) return 'just now'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} minute${min > 1 ? 's' : ''} ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`
    const day = Math.floor(hr / 24)
    if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`
    const wk = Math.floor(day / 7)
    if (wk < 4) return `${wk} week${wk > 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

// ==================== LOCAL FALLBACK DATA (no API yet) ====================
const mockTransactions = [
  { id: 'txn-1', type: 'Credit' as const, amount: 500, description: 'Added via UPI', date: '2024-03-25' },
  { id: 'txn-2', type: 'Debit' as const, amount: 12995, description: 'Order ORD-2024-002 payment', date: '2024-03-20' },
  { id: 'txn-3', type: 'Credit' as const, amount: 200, description: 'Refund for Order ORD-2024-004', date: '2024-03-18' },
  { id: 'txn-4', type: 'Credit' as const, amount: 1000, description: 'Added via Credit Card', date: '2024-03-15' },
  { id: 'txn-5', type: 'Debit' as const, amount: 399, description: 'Order ORD-2024-005 payment', date: '2024-03-14' },
  { id: 'txn-6', type: 'Credit' as const, amount: 50, description: 'Cashback reward', date: '2024-03-12' },
  { id: 'txn-7', type: 'Debit' as const, amount: 112998, description: 'Order ORD-2024-001 payment', date: '2024-03-10' },
  { id: 'txn-8', type: 'Credit' as const, amount: 500, description: 'Referral bonus', date: '2024-03-08' },
]

const mockUserReviews = [
  { id: 'urev-1', productName: 'Samsung Galaxy S24 Ultra', productImage: 'https://picsum.photos/seed/s24ultra-1/80/80', rating: 5, text: 'Best phone I ever owned! The camera is absolutely stunning. S Pen integration is seamless. Battery easily lasts a full day. Worth every rupee!', date: '2024-03-15', helpful: 234 },
  { id: 'urev-2', productName: 'Nike Air Max 270', productImage: 'https://picsum.photos/seed/nike-1/80/80', rating: 4, text: 'The Air Max cushioning is so comfortable. I can wear these all day without any discomfort. Stylish enough for casual wear too.', date: '2024-03-01', helpful: 198 },
  { id: 'urev-3', productName: 'Atomic Habits Book', productImage: 'https://picsum.photos/seed/book-1/80/80', rating: 5, text: 'This book completely changed how I approach habits. The practical strategies are easy to implement. Must read for everyone!', date: '2024-01-10', helpful: 567 },
]

const usedCoupons = [
  { id: 'uc-1', code: 'WELCOME100', description: '₹100 off on your first order', usedOn: '2024-01-15' },
  { id: 'uc-2', code: 'SAVE20', description: '20% off on orders above ₹999', usedOn: '2024-02-20' },
]

// ==================== NAV CONFIG ====================
const navTabs = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'wishlist', label: 'My Wishlist', icon: Heart },
  { id: 'addresses', label: 'My Addresses', icon: MapPin },
  { id: 'wallet', label: 'My Wallet', icon: Wallet },
  { id: 'coupons', label: 'My Coupons', icon: Tag },
  { id: 'reviews', label: 'My Reviews', icon: Star },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// ==================== STATUS HELPERS ====================
function getStatusColor(status: string) {
  const s = (status || '').toLowerCase()
  switch (s) {
    case 'pending':
    case 'confirmed':
    case 'processing': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'shipped': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'delivered': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'cancelled':
    case 'returned': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
  }
}

function getNotifIcon(type: string) {
  const t = normalizeNotifType(type)
  switch (t) {
    case 'Orders': return Package
    case 'Promos': return Tag
    case 'System': return Settings
    default: return Bell
  }
}

// ==================== STAR RATING ====================
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= rating
            ? 'fill-amber-400 text-amber-400'
            : star - 0.5 <= rating
              ? 'fill-amber-400/50 text-amber-400'
              : 'text-gray-300 dark:text-gray-600'
          }
        />
      ))}
    </div>
  )
}

// ==================== TAB CONTENT ANIMATION ====================
const tabVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

// ==================== LOADING / EMPTY STATES ====================
function TabSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-12">
      <X className="mx-auto mb-3 text-red-400" size={40} />
      <p className="text-muted-foreground text-sm mb-3">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>Try Again</Button>
      )}
    </div>
  )
}

// ==================== MY PROFILE TAB ====================
function ProfileTab() {
  const { user, updateProfile } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(user?.name || '')
  const [editEmail, setEditEmail] = useState(user?.email || '')
  const [editPhone, setEditPhone] = useState(user?.phone || '')
  const [copied, setCopied] = useState(false)
  const referralCode = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3) + '2024X'
    : 'USER2024X'

  const membershipTier = user?.walletBalance && user.walletBalance > 5000 ? 'Platinum' :
    user?.walletBalance && user.walletBalance > 2000 ? 'Gold' : 'Silver'

  const tierProgress = membershipTier === 'Silver' ? 35 :
    membershipTier === 'Gold' ? 65 : 90

  const tierColor = membershipTier === 'Platinum'
    ? 'from-purple-500 to-violet-600'
    : membershipTier === 'Gold'
      ? 'from-amber-400 to-yellow-500'
      : 'from-gray-400 to-gray-500'

  const handleSave = () => {
    updateProfile({ name: editName, email: editEmail, phone: editPhone })
    setEditing(false)
  }

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stats = [
    { label: 'Total Orders', value: '23', icon: Package },
    { label: 'Total Spent', value: formatPrice(145680), icon: Wallet },
    { label: 'Wishlist Items', value: '7', icon: Heart },
    { label: 'Reviews Written', value: '12', icon: Star },
  ]

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className={`h-28 bg-gradient-to-r ${tierColor} relative`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-3 right-4">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-sm px-3">
              {membershipTier} Member
            </Badge>
          </div>
        </div>
        <CardContent className="relative pt-0 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-orange-400 to-amber-500 text-white">
                  {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full shadow-md">
                <Edit size={12} />
              </Button>
            </div>
            <div className="flex-1 sm:pb-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold">{user?.name || 'User'}</h2>
                  <p className="text-muted-foreground text-sm">{user?.email || ''}</p>
                  <p className="text-muted-foreground text-sm">{user?.phone || ''}</p>
                  <Button size="sm" variant="ghost" className="mt-1 h-7 text-xs text-orange-500 hover:text-orange-600 px-0" onClick={() => setEditing(true)}>
                    <Edit size={12} className="mr-1" /> Edit Profile
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Membership & Rewards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Membership Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className={`bg-gradient-to-r ${tierColor} text-white border-0`}>
                {membershipTier}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {membershipTier === 'Silver' ? '2,000 more to Gold' :
                  membershipTier === 'Gold' ? '3,000 more to Platinum' : 'Max tier reached!'}
              </span>
            </div>
            <Progress value={tierProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Silver</span>
              <span>Gold</span>
              <span>Platinum</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reward Points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold text-orange-500">
              {user?.rewardPoints?.toLocaleString() || '1,450'}
            </div>
            <p className="text-sm text-muted-foreground">Points worth {formatPrice((user?.rewardPoints || 1450) * 0.25)}</p>
            <Button size="sm" variant="outline" className="w-full text-orange-500 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/20">
              Redeem Points
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Referral Code</p>
              <p className="text-xs text-muted-foreground">Share with friends & earn ₹100 per referral</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-3 py-1.5 rounded-md font-mono text-sm font-bold tracking-wider">
                {referralCode}
              </code>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleCopyReferral}>
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="text-center">
            <CardContent className="p-4">
              <stat.icon className="mx-auto mb-2 text-orange-500" size={20} />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  )
}

// ==================== MY ORDERS TAB ====================
function OrdersTab() {
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [addresses, setAddresses] = useState<Record<string, ApiAddress>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('All')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const fetchOrders = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([])
      setAddresses({})
      setError('Please sign in to view your orders.')
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    setError(null)
    Promise.all([
      apiGet<{ orders: ApiOrder[] }>('/api/orders?limit=50'),
      apiGet<{ addresses: ApiAddress[] }>('/api/addresses').catch(() => ({ addresses: [] })),
    ])
      .then(([data, addrData]) => {
        if (!mounted) return
        setOrders(data.orders || [])
        const addrMap: Record<string, ApiAddress> = {}
        ;(addrData.addresses || []).forEach((a) => { addrMap[a.id] = a })
        setAddresses(addrMap)
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err?.message || 'Failed to load orders')
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [reloadKey, isAuthenticated])

  const filteredOrders = useMemo(() => {
    if (filter === 'All') return orders
    return orders.filter(o => o.status?.toLowerCase() === filter.toLowerCase())
  }, [filter, orders])

  const statusFilters = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

  if (loading) {
    return (
      <motion.div initial="hidden" animate="visible" exit="exit" variants={tabVariants} transition={{ duration: 0.3 }}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none mb-4">
          {statusFilters.map((s) => (
            <div key={s} className="h-8 w-24 bg-muted rounded-md animate-pulse shrink-0" />
          ))}
        </div>
        <TabSkeleton rows={3} />
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div initial="hidden" animate="visible" exit="exit" variants={tabVariants} transition={{ duration: 0.3 }}>
        <ErrorState message={error} onRetry={fetchOrders} />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {statusFilters.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? 'default' : 'outline'}
            onClick={() => setFilter(s)}
            className={filter === s ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shrink-0' : 'shrink-0'}
          >
            {s}
          </Button>
        ))}
      </div>

      {/* Orders List */}
      <AnimatePresence mode="popLayout">
        {filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Package className="mx-auto mb-3 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">No orders found</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const displayStatus = capitalizeStatus(order.status)
              const statusLower = order.status?.toLowerCase()
              const addr = addresses[order.addressId]
              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                            <Badge className={`${getStatusColor(order.status)} text-xs`}>
                              {displayStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{formatPrice(order.total)}</p>
                          <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="flex items-center gap-2 mb-3">
                        {order.items.map((item, idx) => {
                          const imgs = parseImages(item.product?.images)
                          const img = imgs[0] || 'https://picsum.photos/seed/order-item/80/80'
                          return (
                            <div key={idx} className="relative">
                              <img
                                src={img}
                                alt={item.product?.name || 'Product'}
                                className="w-14 h-14 rounded-lg object-cover border"
                              />
                              {idx === 0 && order.items.length > 1 && (
                                <Badge className="absolute -top-1.5 -right-1.5 text-[10px] h-5 min-w-5 flex items-center justify-center bg-orange-500 text-white">
                                  +{order.items.length - 1}
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                        <div className="flex-1 min-w-0 ml-2">
                          <p className="text-sm truncate">{order.items[0]?.product?.name || 'Item'}</p>
                          {order.items.length > 1 && (
                            <p className="text-xs text-muted-foreground">and {order.items.length - 1} more</p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                        >
                          <Eye size={12} className="mr-1" />
                          {expandedOrder === order.id ? 'Hide Details' : 'View Details'}
                        </Button>
                        {statusLower === 'shipped' && (
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            <Truck size={12} className="mr-1" /> Track Order
                          </Button>
                        )}
                        {(statusLower === 'processing' || statusLower === 'pending' || statusLower === 'confirmed') && (
                          <Button size="sm" variant="outline" className="text-xs h-7 text-red-500 hover:text-red-600">
                            <X size={12} className="mr-1" /> Cancel
                          </Button>
                        )}
                        {statusLower === 'delivered' && (
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            <RotateCcw size={12} className="mr-1" /> Return/Exchange
                          </Button>
                        )}
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedOrder === order.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <Separator className="my-3" />
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium">Order Items</h4>
                              {order.items.map((item, idx) => {
                                const imgs = parseImages(item.product?.images)
                                const img = imgs[0] || 'https://picsum.photos/seed/order-item/80/80'
                                const itemPrice = item.salePrice ?? item.price
                                return (
                                  <div key={idx} className="flex items-center gap-3">
                                    <img src={img} alt={item.product?.name || 'Product'} className="w-12 h-12 rounded-lg object-cover border" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{item.product?.name || 'Item'}</p>
                                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="text-sm font-semibold">{formatPrice(itemPrice)}</p>
                                  </div>
                                )
                              })}
                              <Separator />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {addr && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Delivery Address</p>
                                    <p className="text-xs">
                                      {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}
                                    </p>
                                  </div>
                                )}
                                {(order.deliveredAt || order.estimatedDelivery) && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      {statusLower === 'delivered' ? 'Delivered On' : 'Expected Delivery'}
                                    </p>
                                    <p className="text-xs">
                                      {new Date(order.deliveredAt || order.estimatedDelivery || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                  </div>
                                )}
                                {order.trackingId && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Tracking ID</p>
                                    <p className="text-xs font-mono">{order.trackingId}</p>
                                  </div>
                                )}
                                {order.couponCode && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Coupon Applied</p>
                                    <p className="text-xs font-mono">{order.couponCode}</p>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                                <div>
                                  <p className="text-muted-foreground">Subtotal</p>
                                  <p>{formatPrice(order.subtotal)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Discount</p>
                                  <p className="text-emerald-600 dark:text-emerald-400">-{formatPrice(order.discount)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Tax & Shipping</p>
                                  <p>{formatPrice(order.tax + order.shipping)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-muted-foreground">Total</p>
                                  <p className="font-bold">{formatPrice(order.total)}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ==================== MY WISHLIST TAB ====================
function WishlistTab() {
  const { items, removeItem } = useWishlistStore()
  const { addItem } = useCartStore()
  const { navigate } = useNavigationStore()

  if (items.length === 0) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={tabVariants}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-16"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
        >
          <Heart className="text-muted-foreground mb-4" size={64} />
        </motion.div>
        <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
        <p className="text-muted-foreground text-sm mb-4">Add items you love to your wishlist and revisit them anytime.</p>
        <Button
          onClick={() => navigate('products')}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white"
        >
          Start Shopping
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{items.length} item{items.length !== 1 ? 's' : ''} in wishlist</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="group overflow-hidden">
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 h-8 w-8 bg-white/80 backdrop-blur-sm hover:bg-red-50"
                    onClick={() => { void removeItem(item.productId) }}
                  >
                    <X size={14} className="text-red-500" />
                  </Button>
                  {!item.inStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Badge variant="secondary" className="bg-red-500 text-white">Out of Stock</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium line-clamp-2">{item.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">{formatPrice(item.salePrice)}</span>
                    {item.price > item.salePrice && (
                      <span className="text-xs text-muted-foreground line-through">{formatPrice(item.price)}</span>
                    )}
                  </div>
                  {item.inStock && (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white h-8 text-xs"
                      onClick={() => {
                        addItem({
                          id: `cart-${item.productId}`,
                          productId: item.productId,
                          name: item.name,
                          image: item.image,
                          price: item.price,
                          salePrice: item.salePrice,
                          quantity: 1,
                          stock: 10,
                          saveForLater: false,
                        })
                      }}
                    >
                      Add to Cart
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ==================== MY ADDRESSES TAB ====================
function AddressesTab() {
  const { user } = useAuthStore()
  const [addresses, setAddresses] = useState<ApiAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAddr, setEditingAddr] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    phone: user?.phone || '',
    type: 'home' as 'home' | 'work',
    isDefault: false,
  })

  const resetForm = () => {
    setFormData({
      name: user?.name || '',
      line1: '', line2: '', city: '', state: '', pincode: '',
      phone: user?.phone || '', type: 'home', isDefault: false,
    })
  }

  const fetchAddresses = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    apiGet<{ addresses: ApiAddress[] }>('/api/addresses')
      .then((data) => { if (mounted) { setAddresses(data.addresses || []); setError(null) } })
      .catch((err) => { if (mounted) setError(err?.message || 'Failed to load addresses') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [reloadKey])

  const handleEditAddr = (addr: ApiAddress) => {
    setFormData({
      name: addr.name,
      line1: addr.addressLine1,
      line2: addr.addressLine2 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      phone: addr.phone,
      type: (addr.addressType?.toLowerCase() === 'work' ? 'work' : 'home'),
      isDefault: addr.isDefault,
    })
    setEditingAddr(addr.id)
    setShowAddForm(true)
  }

  const handleSaveAddr = async () => {
    if (!formData.name || !formData.phone || !formData.line1 || !formData.city || !formData.state || !formData.pincode) {
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        addressLine1: formData.line1,
        addressLine2: formData.line2 || undefined,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        country: 'India',
        addressType: formData.type,
        isDefault: formData.isDefault,
      }
      if (editingAddr) {
        await apiPut('/api/addresses', { id: editingAddr, ...payload })
      } else {
        await apiPost('/api/addresses', payload)
      }
      setShowAddForm(false)
      setEditingAddr(null)
      resetForm()
      fetchAddresses()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save address'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAddr = async (id: string) => {
    setSubmitting(true)
    try {
      await apiDelete(`/api/addresses/${encodeURIComponent(id)}`)
      fetchAddresses()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete address'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Saved Addresses</h3>
        <Dialog open={showAddForm} onOpenChange={(open) => {
          setShowAddForm(open)
          if (!open) { setEditingAddr(null); resetForm() }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
              <Plus size={14} className="mr-1" /> Add Address
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingAddr ? 'Edit Address' : 'Add New Address'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Full Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Address Line 1</Label>
                <Input value={formData.line1} onChange={(e) => setFormData(p => ({ ...p, line1: e.target.value }))} placeholder="House no., Building, Street" />
              </div>
              <div>
                <Label className="text-xs">Address Line 2</Label>
                <Input value={formData.line2} onChange={(e) => setFormData(p => ({ ...p, line2: e.target.value }))} placeholder="Landmark, Area (optional)" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={formData.city} onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="City" />
                </div>
                <div>
                  <Label className="text-xs">State</Label>
                  <Input value={formData.state} onChange={(e) => setFormData(p => ({ ...p, state: e.target.value }))} placeholder="State" />
                </div>
                <div>
                  <Label className="text-xs">Pincode</Label>
                  <Input value={formData.pincode} onChange={(e) => setFormData(p => ({ ...p, pincode: e.target.value }))} placeholder="Pincode" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-2 block">Address Type</Label>
                <RadioGroup value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v as 'home' | 'work' }))} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="home" id="type-home" />
                    <Label htmlFor="type-home" className="text-sm cursor-pointer">Home</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="work" id="type-work" />
                    <Label htmlFor="type-work" className="text-sm cursor-pointer">Work</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="addr-default"
                  checked={formData.isDefault}
                  onCheckedChange={(v) => setFormData(p => ({ ...p, isDefault: v === true }))}
                />
                <Label htmlFor="addr-default" className="text-sm cursor-pointer">Set as default address</Label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={submitting}>Cancel</Button>
              </DialogClose>
              <Button onClick={() => { void handleSaveAddr() }} disabled={submitting} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                {submitting ? 'Saving...' : editingAddr ? 'Save Changes' : 'Add Address'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <TabSkeleton rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAddresses} />
      ) : addresses.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground">No saved addresses yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add an address to make checkout faster.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => {
            const typeLabel = addr.addressType
              ? addr.addressType.charAt(0).toUpperCase() + addr.addressType.slice(1)
              : 'Home'
            const isWork = addr.addressType?.toLowerCase() === 'work'
            return (
              <motion.div
                key={addr.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{addr.name}</span>
                          <Badge variant="outline" className={`text-[10px] h-5 ${
                            isWork ? 'border-blue-300 text-blue-600' : 'border-emerald-300 text-emerald-600'
                          }`}>
                            {typeLabel}
                          </Badge>
                          {addr.isDefault && (
                            <Badge className="text-[10px] h-5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{addr.phone}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditAddr(addr)}>
                          <Edit size={14} className="text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={submitting} onClick={() => { void handleDeleteAddr(addr.id) }}>
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

// ==================== MY WALLET TAB ====================
function WalletTab() {
  const { user } = useAuthStore()
  const [balance] = useState(user?.walletBalance || 2547.50)
  const [addAmount, setAddAmount] = useState('')
  const [showAddMoney, setShowAddMoney] = useState(false)

  const quickAmounts = [500, 1000, 2000, 5000]

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Balance Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 text-white">
          <p className="text-sm opacity-80 mb-1">Wallet Balance</p>
          <p className="text-4xl font-bold mb-4">{formatPrice(balance)}</p>
          <Dialog open={showAddMoney} onOpenChange={setShowAddMoney}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-white/20">
                <Plus size={16} className="mr-1" /> Add Money
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Money to Wallet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="text-lg"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {quickAmounts.map((amt) => (
                    <Button
                      key={amt}
                      size="sm"
                      variant="outline"
                      onClick={() => setAddAmount(String(amt))}
                      className="flex-1 min-w-[70px]"
                    >
                      {formatPrice(amt)}
                    </Button>
                  ))}
                </div>
                <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white" onClick={() => setShowAddMoney(false)}>
                  Add {addAmount ? formatPrice(Number(addAmount)) : 'Money'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Transaction History */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Transaction History</h3>
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-96">
              <div className="divide-y">
                {mockTransactions.map((txn) => (
                  <motion.div
                    key={txn.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        txn.type === 'Credit'
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {txn.type === 'Credit' ? <Plus size={16} /> : <Minus size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className={`font-semibold text-sm ${
                      txn.type === 'Credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {txn.type === 'Credit' ? '+' : '-'}{formatPrice(txn.amount)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

// ==================== MY COUPONS TAB ====================
function CouponsTab() {
  const [coupons, setCoupons] = useState<ApiCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const fetchCoupons = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    apiGet<{ coupons: ApiCoupon[] }>('/api/coupons')
      .then((data) => { if (mounted) { setCoupons(data.coupons || []); setError(null) } })
      .catch((err) => { if (mounted) setError(err?.message || 'Failed to load coupons') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [reloadKey])

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Available Coupons */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Available Coupons</h3>
        {loading ? (
          <TabSkeleton rows={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchCoupons} />
        ) : coupons.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="mx-auto mb-3 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">No coupons available right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {coupons.map((coupon) => (
              <motion.div
                key={coupon.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="flex">
                    {/* Left side - discount */}
                    <div className="w-20 shrink-0 bg-gradient-to-br from-orange-500 to-amber-500 flex flex-col items-center justify-center text-white p-2 relative">
                      <span className="text-xl font-bold">
                        {coupon.type === 'percentage' ? `${coupon.value}%` : formatPrice(coupon.value)}
                      </span>
                      <span className="text-[10px] opacity-80">OFF</span>
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-background rounded-full" />
                      <div className="absolute -right-2 bottom-0 w-4 h-2 bg-background" />
                      <div className="absolute -right-2 top-0 w-4 h-2 bg-background" />
                    </div>
                    {/* Right side - details */}
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div>
                        <p className="text-sm font-medium">{coupon.description || coupon.code}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Min order: {formatPrice(coupon.minOrder)}
                          {coupon.maxDiscount ? ` · Max ${formatPrice(coupon.maxDiscount)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded tracking-wider font-bold">
                          {coupon.code}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                          onClick={() => handleCopy(coupon.code)}
                        >
                          {copiedCode === coupon.code ? (
                            <><Check size={10} className="mr-0.5" /> Copied</>
                          ) : (
                            <><Copy size={10} className="mr-0.5" /> Copy</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Used Coupons */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Used Coupons</h3>
        <div className="space-y-2">
          {usedCoupons.map((uc) => (
            <Card key={uc.id} className="opacity-60">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <code className="text-sm font-mono font-bold line-through">{uc.code}</code>
                  <p className="text-xs text-muted-foreground">{uc.description}</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs">Used</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{uc.usedOn}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ==================== MY REVIEWS TAB ====================
function ReviewsTab() {
  const [editingReview, setEditingReview] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h3 className="text-lg font-semibold">My Reviews</h3>
      {mockUserReviews.length === 0 ? (
        <div className="text-center py-12">
          <Star className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground">You haven&apos;t written any reviews yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mockUserReviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <img
                      src={review.productImage}
                      alt={review.productName}
                      className="w-16 h-16 rounded-lg object-cover border shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{review.productName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.rating} size={12} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {editingReview === review.id ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs" onClick={() => setEditingReview(null)}>Save</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingReview(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{review.text}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground">
                          <Check size={10} className="inline mr-0.5" /> {review.helpful} found helpful
                        </span>
                        {editingReview !== review.id && (
                          <div className="flex gap-1 ml-auto">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => { setEditingReview(review.id); setEditText(review.text) }}
                            >
                              <Edit size={12} className="text-muted-foreground" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6">
                              <Trash2 size={12} className="text-red-500" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ==================== NOTIFICATIONS TAB ====================
function NotificationsTab() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('All')

  const fetchNotifications = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    apiGet<{ notifications: ApiNotification[]; totalUnread?: number }>('/api/notifications?limit=50')
      .then((data) => { if (mounted) { setNotifications(data.notifications || []); setError(null) } })
      .catch((err) => { if (mounted) setError(err?.message || 'Failed to load notifications') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [reloadKey])

  const filteredNotifications = useMemo(() => {
    if (filter === 'All') return notifications
    return notifications.filter(n => normalizeNotifType(n.type) === filter)
  }, [filter, notifications])

  const unreadCount = notifications.filter(n => !n.isRead).length

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const notifFilters = ['All', 'Orders', 'Promos', 'System']

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge className="bg-orange-500 text-white text-xs">{unreadCount} new</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" className="text-xs text-orange-500" onClick={markAllAsRead}>
            <Check size={12} className="mr-1" /> Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {notifFilters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className={filter === f ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : ''}
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <TabSkeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchNotifications} />
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground">No notifications</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {filteredNotifications.map((notif) => {
                  const IconComp = getNotifIcon(notif.type)
                  const normType = normalizeNotifType(notif.type)
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                        !notif.isRead ? 'bg-orange-50/50 dark:bg-orange-950/10' : ''
                      }`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        normType === 'Orders' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        normType === 'Promos' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        <IconComp size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${!notif.isRead ? 'font-semibold' : 'font-medium'}`}>{notif.title}</p>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(notif.createdAt)}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

// ==================== SETTINGS TAB ====================
function SettingsTab() {
  const { logout } = useAuthStore()
  const { navigate } = useNavigationStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailPrefs, setEmailPrefs] = useState({
    newsletter: true,
    orderUpdates: true,
    promoEmails: false,
  })
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const handleChangePassword = () => {
    if (newPassword && newPassword === confirmPassword) {
      setPasswordSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 3000)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('home')
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabVariants}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Change Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription className="text-xs">Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {passwordSaved && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-sm p-3 rounded-lg flex items-center gap-2"
            >
              <Check size={16} /> Password changed successfully!
            </motion.div>
          )}
          <div>
            <Label className="text-xs">Current Password</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
            </div>
            <div>
              <Label className="text-xs">Confirm Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
          <Button onClick={handleChangePassword} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* Email Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Email Preferences</CardTitle>
          <CardDescription className="text-xs">Choose which emails you want to receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Newsletter</p>
              <p className="text-xs text-muted-foreground">Weekly deals, new arrivals, and style tips</p>
            </div>
            <Switch
              checked={emailPrefs.newsletter}
              onCheckedChange={(v) => setEmailPrefs(p => ({ ...p, newsletter: v }))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Order Updates</p>
              <p className="text-xs text-muted-foreground">Shipping, delivery, and return notifications</p>
            </div>
            <Switch
              checked={emailPrefs.orderUpdates}
              onCheckedChange={(v) => setEmailPrefs(p => ({ ...p, orderUpdates: v }))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Promotional Emails</p>
              <p className="text-xs text-muted-foreground">Sales, coupons, and special offers</p>
            </div>
            <Switch
              checked={emailPrefs.promoEmails}
              onCheckedChange={(v) => setEmailPrefs(p => ({ ...p, promoEmails: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logout & Delete */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            onClick={handleLogout}
          >
            <LogOut size={16} className="mr-2" /> Logout
          </Button>
          <Separator />
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                <Trash2 size={16} className="mr-2" /> Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Account</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data, orders, and wallet balance will be lost.
              </p>
              <DialogFooter className="gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => { handleLogout(); setShowDeleteDialog(false) }}>
                  Delete Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ==================== SIDEBAR NAV ITEM ====================
function SidebarNavItem({
  tab,
  isActive,
  onClick,
}: {
  tab: typeof navTabs[0]
  isActive: boolean
  onClick: () => void
}) {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 text-left ${
        isActive
          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200 dark:shadow-orange-900/30'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon size={18} />
      <span>{tab.label}</span>
      {isActive && <ChevronRight size={14} className="ml-auto" />}
    </button>
  )
}

// ==================== MAIN DASHBOARD COMPONENT ====================
export default function UserDashboard() {
  const { dashboardTab, setDashboardTab } = useNavigationStore()
  const { user } = useAuthStore()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const activeTab = dashboardTab || 'profile'

  const setTab = (tabId: string) => {
    setDashboardTab(tabId)
    setMobileNavOpen(false)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab />
      case 'orders': return <OrdersTab />
      case 'wishlist': return <WishlistTab />
      case 'addresses': return <AddressesTab />
      case 'wallet': return <WalletTab />
      case 'coupons': return <CouponsTab />
      case 'reviews': return <ReviewsTab />
      case 'notifications': return <NotificationsTab />
      case 'settings': return <SettingsTab />
      default: return <ProfileTab />
    }
  }

  const activeTabLabel = navTabs.find(t => t.id === activeTab)?.label || 'Dashboard'

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Account</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}!
            </p>
          </div>
          {/* Mobile nav trigger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <User size={16} className="mr-1" /> Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="text-left">Dashboard</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-80px)]">
                <div className="p-3 space-y-1">
                  {/* User Mini Profile in Mobile Sidebar */}
                  <div className="flex items-center gap-3 p-3 mb-3 rounded-lg bg-muted/50">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="text-sm bg-gradient-to-br from-orange-400 to-amber-500 text-white">
                        {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email || 'user@email.com'}</p>
                    </div>
                  </div>
                  <Separator className="mb-3" />
                  {navTabs.map((tab) => (
                    <SidebarNavItem
                      key={tab.id}
                      tab={tab}
                      isActive={activeTab === tab.id}
                      onClick={() => setTab(tab.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <Card>
                <CardContent className="p-3">
                  {/* User Mini Profile */}
                  <div className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-muted/50">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="text-sm bg-gradient-to-br from-orange-400 to-amber-500 text-white">
                        {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email || 'user@email.com'}</p>
                    </div>
                  </div>
                  <Separator className="mb-2" />
                  <nav className="space-y-1">
                    {navTabs.map((tab) => (
                      <SidebarNavItem
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab === tab.id}
                        onClick={() => setTab(tab.id)}
                      />
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile Tab Title */}
            <div className="lg:hidden mb-4">
              <Badge variant="outline" className="text-sm font-medium">
                {activeTabLabel}
              </Badge>
            </div>

            <AnimatePresence mode="wait">
              <div key={activeTab}>
                {renderTabContent()}
              </div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  )
}
