'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/store/cart-store'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'
import { formatPrice } from '@/lib/mock-data'
import { apiGet, apiPost } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MapPin,
  CreditCard,
  Building2,
  Wallet,
  Truck,
  Check,
  ChevronRight,
  ChevronLeft,
  Lock,
  Plus,
  Smartphone,
  Banknote,
  Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────

interface Address {
  id: string
  userId?: string
  name: string
  phone: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  pincode: string
  country?: string
  isDefault?: boolean
  addressType: string
  createdAt?: string
  updatedAt?: string
}

interface OrderItem {
  id: string
  productId: string
  variantId?: string | null
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
  }
}

interface Order {
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
  createdAt: string
  items: OrderItem[]
}

/** Parse a product's images JSON string into a string array. */
function parseImages(raw: string | undefined | null): string[] {
  try {
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch {
    return []
  }
}

// ── Step type ─────────────────────────────────────────────────────────

type Step = 'address' | 'payment' | 'review' | 'confirmation'

const steps: { key: Step; label: string; icon: typeof MapPin }[] = [
  { key: 'address', label: 'Address', icon: MapPin },
  { key: 'payment', label: 'Payment', icon: CreditCard },
  { key: 'review', label: 'Review', icon: Check },
  { key: 'confirmation', label: 'Confirmed', icon: Check },
]

// ── Main Component ────────────────────────────────────────────────────

export function CheckoutPage() {
  const { items, couponCode, couponDiscount, getSubtotal, getDiscount, getTotal, clearCart } =
    useCartStore()
  const navigate = useNavigationStore((s) => s.navigate)
  const auth = useAuthStore()
  const { toast } = useToast()

  const cartItems = items.filter((i) => !i.saveForLater)
  const subtotal = getSubtotal()
  const discount = getDiscount()
  const shipping = subtotal > 500 ? 0 : 49
  const total = getTotal()

  const [currentStep, setCurrentStep] = useState<Step>('address')
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [upiId, setUpiId] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardName, setCardName] = useState('')
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)

  // Addresses (DB-backed)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addingAddress, setAddingAddress] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)

  // Address form
  const [newAddress, setNewAddress] = useState<Omit<Address, 'id'>>({
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    addressType: 'home',
    isDefault: false,
  })

  // ── Fetch addresses from /api/addresses ────────────────────────────
  const fetchAddresses = useCallback(async () => {
    try {
      setAddressesLoading(true)
      const data = await apiGet<{ addresses: Address[] }>('/api/addresses')
      const list = data.addresses || []
      setAddresses(list)
      // Auto-select default or first address (only if user hasn't picked one)
      setSelectedAddressId((prev) =>
        prev
          ? prev
          : list.find((a) => a.isDefault)?.id || list[0]?.id || ''
      )
      // Auto-open the form if the user has no addresses yet
      if (list.length === 0) {
        setShowAddressForm(true)
      }
    } catch (err) {
      toast({
        title: 'Could not load addresses',
        description: err instanceof Error ? err.message : 'Please try again later.',
        variant: 'destructive',
      })
    } finally {
      setAddressesLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!auth.isAuthenticated) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAddresses()
  }, [auth.isAuthenticated, fetchAddresses])

  // Redirect if cart is empty (unless on confirmation)
  useEffect(() => {
    if (cartItems.length === 0 && currentStep !== 'confirmation') {
      navigate('cart')
    }
  }, [cartItems.length, currentStep, navigate])

  // Redirect to auth if not signed in (unless on confirmation)
  useEffect(() => {
    if (!auth.isAuthenticated && currentStep !== 'confirmation') {
      toast({
        title: 'Please sign in to continue',
        description: 'You need to be signed in to place your order.',
        variant: 'destructive',
      })
      navigate('auth')
    }
  }, [auth.isAuthenticated, currentStep, navigate, toast])

  const stepIndex = steps.findIndex((s) => s.key === currentStep)

  const handleNext = async () => {
    if (currentStep === 'address') {
      setCurrentStep('payment')
      return
    }
    if (currentStep === 'payment') {
      setCurrentStep('review')
      return
    }
    if (currentStep === 'review') {
      // ── Place Order ──
      if (!selectedAddressId) {
        toast({
          title: 'Select an address',
          description: 'Please choose a delivery address before placing your order.',
          variant: 'destructive',
        })
        return
      }
      try {
        setPlacingOrder(true)
        const data = await apiPost<{ order: Order }>('/api/orders', {
          addressId: selectedAddressId,
          paymentMethod,
          couponCode: couponCode || undefined,
          notes: undefined,
        })
        const order = data.order
        setPlacedOrder(order)
        clearCart()
        setCurrentStep('confirmation')
        toast({
          title: 'Order placed!',
          description: `Your order #${order.orderNumber} has been placed successfully.`,
        })
      } catch (err) {
        toast({
          title: 'Could not place order',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setPlacingOrder(false)
      }
    }
  }

  const handleBack = () => {
    if (currentStep === 'payment') setCurrentStep('address')
    else if (currentStep === 'review') setCurrentStep('payment')
  }

  const handleAddAddress = async () => {
    try {
      setAddingAddress(true)
      const data = await apiPost<{ address: Address }>('/api/addresses', {
        name: newAddress.name,
        phone: newAddress.phone,
        addressLine1: newAddress.addressLine1,
        addressLine2: newAddress.addressLine2 || undefined,
        city: newAddress.city,
        state: newAddress.state,
        pincode: newAddress.pincode,
        country: newAddress.country || 'India',
        addressType: newAddress.addressType,
        isDefault: newAddress.isDefault,
      })
      // Re-fetch to keep the local list in sync with the server
      await fetchAddresses()
      // Select the newly-created address
      setSelectedAddressId(data.address.id)
      setShowAddressForm(false)
      setNewAddress({
        name: '',
        phone: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        addressType: 'home',
        isDefault: false,
      })
      toast({
        title: 'Address added',
        description: 'Your new address has been saved.',
      })
    } catch (err) {
      toast({
        title: 'Could not save address',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setAddingAddress(false)
    }
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)

  const canProceed = () => {
    if (currentStep === 'address') return !!selectedAddressId
    if (currentStep === 'payment') {
      if (paymentMethod === 'upi') return upiId.includes('@')
      if (paymentMethod === 'card')
        return cardNumber.length >= 16 && cardExpiry.length >= 4 && cardCvv.length >= 3
      return true
    }
    return true
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Steps Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, i) => {
            const isCompleted = i < stepIndex
            const isCurrent = i === stepIndex
            const Icon = step.icon
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={{
                      scale: isCurrent ? 1.1 : 1,
                      backgroundColor: isCompleted
                        ? '#22c55e'
                        : isCurrent
                          ? '#f97316'
                          : '#e5e7eb',
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Icon
                        className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-gray-500'}`}
                      />
                    )}
                  </motion.div>
                  <span
                    className={`text-xs mt-1.5 font-medium ${isCurrent ? 'text-orange-600 dark:text-orange-400' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 mx-2 mt-[-1.25rem]">
                    <div className="h-0.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full bg-green-500"
                        initial={{ width: '0%' }}
                        animate={{
                          width: i < stepIndex ? '100%' : '0%',
                        }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {currentStep === 'address' && (
              <StepWrapper key="address">
                <AddressStep
                  addresses={addresses}
                  addressesLoading={addressesLoading}
                  selectedId={selectedAddressId}
                  onSelect={setSelectedAddressId}
                  showForm={showAddressForm}
                  onToggleForm={() => setShowAddressForm(!showAddressForm)}
                  newAddress={newAddress}
                  onNewAddressChange={setNewAddress}
                  onAddAddress={handleAddAddress}
                  addingAddress={addingAddress}
                />
              </StepWrapper>
            )}
            {currentStep === 'payment' && (
              <StepWrapper key="payment">
                <PaymentStep
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={setPaymentMethod}
                  upiId={upiId}
                  onUpiIdChange={setUpiId}
                  cardNumber={cardNumber}
                  onCardNumberChange={setCardNumber}
                  cardExpiry={cardExpiry}
                  onCardExpiryChange={setCardExpiry}
                  cardCvv={cardCvv}
                  onCardCvvChange={setCardCvv}
                  cardName={cardName}
                  onCardNameChange={setCardName}
                />
              </StepWrapper>
            )}
            {currentStep === 'review' && (
              <StepWrapper key="review">
                <ReviewStep
                  items={cartItems}
                  address={selectedAddress}
                  paymentMethod={paymentMethod}
                  upiId={upiId}
                />
              </StepWrapper>
            )}
            {currentStep === 'confirmation' && placedOrder && (
              <StepWrapper key="confirmation">
                <ConfirmationStep
                  order={placedOrder}
                  address={selectedAddress}
                  onTrackOrder={() => navigate('user-dashboard', { tab: 'orders' })}
                  onContinueShopping={() => {
                    clearCart()
                    navigate('home')
                  }}
                />
              </StepWrapper>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          {currentStep !== 'confirmation' && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 'address'}
                className="rounded-xl"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed() || placingOrder}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/20 min-w-[140px]"
              >
                {currentStep === 'review' ? (
                  <>
                    {placingOrder ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4 mr-1" />
                    )}
                    {placingOrder ? 'Placing Order...' : 'Place Order'}
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        {currentStep !== 'confirmation' && (
          <div className="lg:col-span-1">
            <OrderSummary
              items={cartItems}
              subtotal={subtotal}
              discount={discount}
              couponCode={couponCode}
              couponDiscount={couponDiscount}
              shipping={shipping}
              total={total}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step animation wrapper ─────────────────────────────────────────────

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

// ── Address Step ───────────────────────────────────────────────────────

function AddressStep({
  addresses,
  addressesLoading,
  selectedId,
  onSelect,
  showForm,
  onToggleForm,
  newAddress,
  onNewAddressChange,
  onAddAddress,
  addingAddress,
}: {
  addresses: Address[]
  addressesLoading: boolean
  selectedId: string
  onSelect: (id: string) => void
  showForm: boolean
  onToggleForm: () => void
  newAddress: Omit<Address, 'id'>
  onNewAddressChange: (addr: Omit<Address, 'id'>) => void
  onAddAddress: () => void
  addingAddress: boolean
}) {
  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            Select Delivery Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          {addressesLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading your saved addresses...
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">
                No saved addresses yet
              </p>
              <p className="text-xs text-muted-foreground">
                Add a delivery address to continue.
              </p>
            </div>
          ) : (
            <RadioGroup value={selectedId} onValueChange={onSelect} className="space-y-3">
              {addresses.map((addr) => (
                <label
                  key={addr.id}
                  htmlFor={addr.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedId === addr.id
                      ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <RadioGroupItem value={addr.id} id={addr.id} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{addr.name}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {addr.addressType
                          ? addr.addressType.charAt(0).toUpperCase() +
                            addr.addressType.slice(1)
                          : 'Home'}
                      </Badge>
                      {addr.isDefault && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-green-600 border-green-500/40"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ''},{' '}
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {addr.phone}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}

          {!addressesLoading && addresses.length > 0 && (
            <Button
              variant="outline"
              className="w-full mt-4 rounded-xl border-dashed"
              onClick={onToggleForm}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add New Address
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Add New Address Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-orange-200 dark:border-orange-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Add New Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Full Name</Label>
                    <Input
                      id="new-name"
                      value={newAddress.name}
                      onChange={(e) =>
                        onNewAddressChange({ ...newAddress, name: e.target.value })
                      }
                      placeholder="Enter full name"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-phone">Phone Number</Label>
                    <Input
                      id="new-phone"
                      value={newAddress.phone}
                      onChange={(e) =>
                        onNewAddressChange({ ...newAddress, phone: e.target.value })
                      }
                      placeholder="+91 XXXXX XXXXX"
                      className="rounded-lg"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-line1">Address Line 1</Label>
                  <Input
                    id="new-line1"
                    value={newAddress.addressLine1}
                    onChange={(e) =>
                      onNewAddressChange({ ...newAddress, addressLine1: e.target.value })
                    }
                    placeholder="House/Flat No., Building Name"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-line2">Address Line 2</Label>
                  <Input
                    id="new-line2"
                    value={newAddress.addressLine2 || ''}
                    onChange={(e) =>
                      onNewAddressChange({ ...newAddress, addressLine2: e.target.value })
                    }
                    placeholder="Street, Locality, Landmark"
                    className="rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-city">City</Label>
                    <Input
                      id="new-city"
                      value={newAddress.city}
                      onChange={(e) =>
                        onNewAddressChange({ ...newAddress, city: e.target.value })
                      }
                      placeholder="City"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-state">State</Label>
                    <Input
                      id="new-state"
                      value={newAddress.state}
                      onChange={(e) =>
                        onNewAddressChange({ ...newAddress, state: e.target.value })
                      }
                      placeholder="State"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pincode">Pincode</Label>
                    <Input
                      id="new-pincode"
                      value={newAddress.pincode}
                      onChange={(e) =>
                        onNewAddressChange({ ...newAddress, pincode: e.target.value })
                      }
                      placeholder="6 digits"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-type">Type</Label>
                    <Select
                      value={newAddress.addressType}
                      onValueChange={(v) =>
                        onNewAddressChange({
                          ...newAddress,
                          addressType: v,
                        })
                      }
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="work">Work</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={!!newAddress.isDefault}
                    onCheckedChange={(v) =>
                      onNewAddressChange({ ...newAddress, isDefault: v === true })
                    }
                  />
                  Set as default address
                </label>
                <Button
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                  onClick={onAddAddress}
                  disabled={
                    addingAddress ||
                    !newAddress.name ||
                    !newAddress.phone ||
                    !newAddress.addressLine1 ||
                    !newAddress.city ||
                    !newAddress.state ||
                    !newAddress.pincode
                  }
                >
                  {addingAddress ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {addingAddress ? 'Saving...' : 'Save Address'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Payment Step ───────────────────────────────────────────────────────

function PaymentStep({
  paymentMethod,
  onPaymentMethodChange,
  upiId,
  onUpiIdChange,
  cardNumber,
  onCardNumberChange,
  cardExpiry,
  onCardExpiryChange,
  cardCvv,
  onCardCvvChange,
  cardName,
  onCardNameChange,
}: {
  paymentMethod: string
  onPaymentMethodChange: (m: string) => void
  upiId: string
  onUpiIdChange: (v: string) => void
  cardNumber: string
  onCardNumberChange: (v: string) => void
  cardExpiry: string
  onCardExpiryChange: (v: string) => void
  cardCvv: string
  onCardCvvChange: (v: string) => void
  cardName: string
  onCardNameChange: (v: string) => void
}) {
  const paymentOptions = [
    { key: 'upi', label: 'UPI', icon: Smartphone, desc: 'Pay via UPI ID' },
    { key: 'card', label: 'Credit/Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Rupay' },
    { key: 'netbanking', label: 'Net Banking', icon: Building2, desc: 'All major banks' },
    { key: 'wallet', label: 'Wallet', icon: Wallet, desc: 'Paytm, PhonePe, Amazon Pay' },
    { key: 'cod', label: 'Cash on Delivery', icon: Banknote, desc: 'Pay on delivery' },
  ]

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-500" />
          Select Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={paymentMethod}
          onValueChange={onPaymentMethodChange}
          className="space-y-3"
        >
          {paymentOptions.map((opt) => {
            const Icon = opt.icon
            return (
              <label
                key={opt.key}
                htmlFor={`pay-${opt.key}`}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === opt.key
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20'
                    : 'border-border/50 hover:border-border'
                }`}
              >
                <RadioGroupItem value={opt.key} id={`pay-${opt.key}`} />
                <Icon
                  className={`w-5 h-5 ${paymentMethod === opt.key ? 'text-orange-500' : 'text-muted-foreground'}`}
                />
                <div>
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            )
          })}
        </RadioGroup>

        {/* Conditional forms */}
        <AnimatePresence mode="wait">
          {paymentMethod === 'upi' && (
            <motion.div
              key="upi-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4"
            >
              <div className="space-y-2">
                <Label htmlFor="upi-id">UPI ID</Label>
                <Input
                  id="upi-id"
                  value={upiId}
                  onChange={(e) => onUpiIdChange(e.target.value)}
                  placeholder="yourname@upi"
                  className="rounded-lg max-w-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your UPI ID (e.g., name@paytm, name@oksbi)
                </p>
              </div>
            </motion.div>
          )}

          {paymentMethod === 'card' && (
            <motion.div
              key="card-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="card-number">Card Number</Label>
                <Input
                  id="card-number"
                  value={cardNumber}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                    onCardNumberChange(v)
                  }}
                  placeholder="1234 5678 9012 3456"
                  className="rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="card-expiry">Expiry</Label>
                  <Input
                    id="card-expiry"
                    value={cardExpiry}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, '').slice(0, 4)
                      if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2)
                      onCardExpiryChange(v)
                    }}
                    placeholder="MM/YY"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input
                    id="card-cvv"
                    type="password"
                    value={cardCvv}
                    onChange={(e) =>
                      onCardCvvChange(e.target.value.replace(/\D/g, '').slice(0, 3))
                    }
                    placeholder="***"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-name">Name on Card</Label>
                  <Input
                    id="card-name"
                    value={cardName}
                    onChange={(e) => onCardNameChange(e.target.value)}
                    placeholder="Full Name"
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                Your card details are encrypted and secure
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

// ── Review Step ────────────────────────────────────────────────────────

function ReviewStep({
  items,
  address,
  paymentMethod,
  upiId,
}: {
  items: ReturnType<typeof useCartStore.getState>['items']
  address?: Address
  paymentMethod: string
  upiId: string
}) {
  const paymentLabels: Record<string, string> = {
    upi: `UPI (${upiId || 'Not provided'})`,
    card: 'Credit/Debit Card',
    netbanking: 'Net Banking',
    wallet: 'Wallet',
    cod: 'Cash on Delivery',
  }

  return (
    <div className="space-y-4">
      {/* Delivery Address */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-500" />
            Delivery Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          {address ? (
            <div className="text-sm">
              <p className="font-semibold">{address.name}</p>
              <p className="text-muted-foreground">
                {address.addressLine1}
                {address.addressLine2 ? `, ${address.addressLine2}` : ''},{' '}
                {address.city}, {address.state} - {address.pincode}
              </p>
              <p className="text-muted-foreground">{address.phone}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No address selected</p>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-500" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{paymentLabels[paymentMethod] || paymentMethod}</p>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-500" />
            Order Items ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border/30">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.color && <span>{item.color}</span>}
                  {item.size && <span>Size: {item.size}</span>}
                  <span>Qty: {item.quantity}</span>
                </div>
              </div>
              <p className="text-sm font-semibold flex-shrink-0">
                {formatPrice((item.salePrice || item.price) * item.quantity)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Confirmation Step ──────────────────────────────────────────────────

function ConfirmationStep({
  order,
  address,
  onTrackOrder,
  onContinueShopping,
}: {
  order: Order
  address?: Address
  onTrackOrder: () => void
  onContinueShopping: () => void
}) {
  const deliveryDate = new Date()
  deliveryDate.setDate(deliveryDate.getDate() + 5)
  const formattedDate = deliveryDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="text-center py-8">
      {/* Confetti / Success Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.8, bounce: 0.5 }}
        className="relative w-24 h-24 mx-auto mb-6"
      >
        <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-950/40" />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', duration: 0.5 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: 'spring', duration: 0.5 }}
            >
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </motion.div>
          </div>
        </motion.div>
        {/* Confetti dots */}
        {[...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2
          const distance = 60
          return (
            <motion.div
              key={i}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1.2, 0],
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
              }}
              transition={{ delay: 0.6 + i * 0.05, duration: 0.8 }}
              className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'][i],
              }}
            />
          )
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Order Placed Successfully!
        </h2>
        <p className="text-muted-foreground mb-6">
          Thank you for your order. We&apos;ll send you a confirmation email shortly.
        </p>

        <Card className="border-border/50 max-w-md mx-auto text-left mb-6">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Order ID</span>
              <Badge className="font-mono">{order.orderNumber}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Estimated Delivery
              </span>
              <span className="text-sm font-medium">{formattedDate}</span>
            </div>
            {address && (
              <>
                <Separator />
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">
                    Delivering to
                  </span>
                  <p className="text-sm font-medium">{address.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {address.addressLine1}, {address.city}, {address.state} -{' '}
                    {address.pincode}
                  </p>
                </div>
              </>
            )}

            {/* Order Items */}
            {order.items.length > 0 && (
              <>
                <Separator />
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">
                    Items ({order.items.length})
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {order.items.map((item) => {
                      const imgs = parseImages(item.product.images)
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div className="w-8 h-8 rounded bg-muted flex-shrink-0 overflow-hidden">
                            {imgs[0] && (
                              <img
                                src={imgs[0]}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <span className="flex-1 line-clamp-1 text-xs">
                            {item.product.name}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            x{item.quantity}
                          </span>
                          <span className="text-xs font-medium flex-shrink-0">
                            {formatPrice(item.total)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Order Totals */}
            <Separator />
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    -{formatPrice(order.discount)}
                  </span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatPrice(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">
                  {order.shipping === 0 ? (
                    <span className="text-green-600 dark:text-green-400">FREE</span>
                  ) : (
                    formatPrice(order.shipping)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button
            onClick={onTrackOrder}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
          >
            <Truck className="w-4 h-4 mr-2" />
            Track Order
          </Button>
          <Button variant="outline" onClick={onContinueShopping} className="rounded-xl">
            Continue Shopping
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Order Summary Sidebar ──────────────────────────────────────────────

function OrderSummary({
  items,
  subtotal,
  discount,
  couponCode,
  couponDiscount,
  shipping,
  total,
}: {
  items: ReturnType<typeof useCartStore.getState>['items']
  subtotal: number
  discount: number
  couponCode: string
  couponDiscount: number
  shipping: number
  total: number
}) {
  const totalSavings = items.reduce(
    (sum, i) => sum + (i.price - (i.salePrice || i.price)) * i.quantity,
    0
  )

  return (
    <div className="lg:sticky lg:top-6">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Item list */}
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded bg-muted flex-shrink-0 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="flex-1 line-clamp-1 text-xs">{item.name}</span>
                <span className="text-xs font-medium flex-shrink-0">
                  x{item.quantity}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>

            {totalSavings > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product Discount</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  -{formatPrice(totalSavings)}
                </span>
              </div>
            )}

            {couponDiscount > 0 && discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Coupon ({couponCode})
                </span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  -{formatPrice(discount)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="font-medium">
                {shipping === 0 ? (
                  <span className="text-green-600 dark:text-green-400">FREE</span>
                ) : (
                  formatPrice(shipping)
                )}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
            <Lock className="w-3.5 h-3.5 text-green-500" />
            Secure Checkout
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
