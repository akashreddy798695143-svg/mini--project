'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  ShoppingCart,
  Star,
  ChevronLeft,
  ChevronRight,
  Eye,
  Truck,
  Clock,
  Zap,
  TrendingUp,
  Sparkles,
  Crown,
  QrCode,
  Apple,
  Play,
  Mail,
  ArrowRight,
  Flame,
  BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  banners,
  formatPrice,
  reviews,
} from '@/lib/mock-data'
import type { Review } from '@/lib/mock-data'
import { apiGet } from '@/lib/api-client'
import { useNavigationStore } from '@/store/navigation-store'
import { useCartStore } from '@/store/cart-store'
import { useWishlistStore } from '@/store/wishlist-store'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  icon?: string | null
  parentId: string | null
  isActive: boolean
  sortOrder?: number
  productCount?: number
  children?: Category[]
}

interface Brand {
  id: string
  name: string
  slug: string
  logo?: string | null
  description?: string | null
  isActive: boolean
  productCount?: number
}

interface ApiProduct {
  id: string
  name: string
  slug: string
  description: string
  shortDesc: string | null
  categoryId: string
  brandId: string | null
  basePrice: number
  salePrice: number | null
  images: string
  colors: string | null
  sizes: string | null
  highlights: string | null
  stock: number
  isFeatured: boolean
  isNewArrival: boolean
  isTrending: boolean
  isBestSeller: boolean
  isActive: boolean
  avgRating: number
  totalReviews: number
  totalSold: number
  discount: number
  deliveryDays: number
  isFreeDelivery: boolean
  category: { id: string; name: string; slug: string }
  brand: { id: string; name: string; slug: string; logo: string | null } | null
}

interface Product {
  id: string
  name: string
  slug: string
  description: string
  shortDesc: string
  categoryId: string
  brandId: string
  basePrice: number
  salePrice: number
  images: string[]
  colors: string[]
  sizes: string[]
  stock: number
  isFeatured: boolean
  isNewArrival: boolean
  isTrending: boolean
  isBestSeller: boolean
  isActive: boolean
  avgRating: number
  totalReviews: number
  totalSold: number
  discount: number
  deliveryDays: number
  isFreeDelivery: boolean
  brand: { id: string; name: string; slug: string; logo: string | null } | null
}

function parseJsonArray<T = string>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function normalizeProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description || '',
    shortDesc: p.shortDesc || '',
    categoryId: p.categoryId,
    brandId: p.brandId || '',
    basePrice: p.basePrice,
    salePrice: p.salePrice ?? p.basePrice,
    images: parseJsonArray<string>(p.images),
    colors: parseJsonArray<string>(p.colors),
    sizes: parseJsonArray<string>(p.sizes),
    stock: p.stock,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isTrending: p.isTrending,
    isBestSeller: p.isBestSeller,
    isActive: p.isActive,
    avgRating: p.avgRating,
    totalReviews: p.totalReviews,
    totalSold: p.totalSold,
    discount: p.discount,
    deliveryDays: p.deliveryDays,
    isFreeDelivery: p.isFreeDelivery,
    brand: p.brand,
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────
const FLASH_SALE_END = new Date(Date.now() + 6 * 60 * 60 * 1000)

// ─── Star Rating ─────────────────────────────────────────────────────────────
function StarRating({ rating, count, size = 14 }: { rating: number; count?: number; size?: number }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.3
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`f${i}`} size={size} className="fill-amber-400 text-amber-400" />
        ))}
        {hasHalf && (
          <div className="relative" style={{ width: size, height: size }}>
            <Star size={size} className="text-gray-300" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
              <Star size={size} className="fill-amber-400 text-amber-400" />
            </div>
          </div>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`e${i}`} size={size} className="text-gray-300" />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground ml-0.5">({count.toLocaleString()})</span>
      )}
    </div>
  )
}

// ─── Product Card (reusable inline component) ────────────────────────────────
function ProductCard({
  product,
  badge,
  rank,
}: {
  product: Product
  badge?: React.ReactNode
  rank?: number
}) {
  const navigate = useNavigationStore(s => s.navigate)
  const addItem = useCartStore(s => s.addItem)
  const { addItem: addWishlist, removeItem: removeWishlist, isInWishlist } = useWishlistStore()
  const wishlisted = isInWishlist(product.id)
  const [isHovered, setIsHovered] = useState(false)

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      addItem({
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        image: product.images[0] || '',
        price: product.basePrice,
        salePrice: product.salePrice,
        quantity: 1,
        stock: product.stock,
        saveForLater: false,
      })
    },
    [addItem, product],
  )

  const handleWishlist = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (wishlisted) {
        removeWishlist(product.id)
      } else {
        addWishlist({
          id: product.id,
          productId: product.id,
          name: product.name,
          image: product.images[0] || '',
          price: product.basePrice,
          salePrice: product.salePrice,
          rating: product.avgRating,
          inStock: product.stock > 0,
        })
      }
    },
    [wishlisted, addWishlist, removeWishlist, product],
  )

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-xl hover:shadow-orange-500/10"
      onClick={() => navigate('product-detail', { productId: product.id })}
    >
      {/* Rank badge */}
      {rank !== undefined && (
        <div className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          #{rank}
        </div>
      )}

      {/* Image area */}
      <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-zinc-800">
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Discount badge */}
        {product.discount > 0 && (
          <Badge className="absolute top-2 left-2 z-10 bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 text-[11px] font-semibold px-2 py-0.5">
            -{product.discount}%
          </Badge>
        )}

        {/* Custom badge */}
        {badge && (
          <div className="absolute top-2 right-2 z-10">{badge}</div>
        )}

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-white dark:hover:bg-zinc-800 shadow-sm"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart
            size={16}
            className={
              wishlisted
                ? 'fill-red-500 text-red-500'
                : 'text-gray-500 dark:text-gray-400'
            }
          />
        </button>

        {/* Quick View overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/30 flex items-center justify-center z-10"
            >
              <Button
                size="sm"
                className="bg-white/90 text-gray-900 hover:bg-white shadow-lg gap-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('product-detail', { productId: product.id })
                }}
              >
                <Eye size={14} />
                Quick View
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        {/* Brand */}
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {product.brand?.name ?? ''}
        </span>

        {/* Name */}
        <h3 className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Rating */}
        <StarRating rating={product.avgRating} count={product.totalReviews} size={12} />

        {/* Price row */}
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
            {formatPrice(product.salePrice)}
          </span>
          {product.basePrice > product.salePrice && (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.basePrice)}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {product.discount}% off
              </span>
            </>
          )}
        </div>

        {/* Free delivery */}
        {product.isFreeDelivery && (
          <div className="flex items-center gap-1 mt-0.5">
            <Truck size={12} className="text-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Free Delivery</span>
          </div>
        )}

        {/* Add to cart */}
        <Button
          size="sm"
          className="mt-auto w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-md hover:shadow-lg transition-all gap-1.5 text-xs font-semibold"
          onClick={handleAddToCart}
        >
          <ShoppingCart size={14} />
          Add to Cart
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Section Wrapper with scroll animation ───────────────────────────────────
function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2.5">
        {icon && <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">{icon}</div>}
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actionLabel && onAction && (
        <Button
          variant="ghost"
          className="text-orange-600 dark:text-orange-400 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 font-semibold gap-1"
          onClick={onAction}
        >
          {actionLabel}
          <ArrowRight size={16} />
        </Button>
      )}
    </div>
  )
}

// ─── Horizontal Scroll Row ───────────────────────────────────────────────────
function HorizontalScroll({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent ${className}`}>
      {children}
    </div>
  )
}

// ─── Skeleton helpers ────────────────────────────────────────────────────────
function CategorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-2.5 min-w-[90px] sm:min-w-[100px] p-3">
      <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-2 w-12" />
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <Skeleton className="aspect-square w-full" />
      <div className="flex flex-col gap-2 p-3 flex-1">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-full mt-auto" />
      </div>
    </Card>
  )
}

function FlashSaleCardSkeleton() {
  return (
    <div className="min-w-[180px] sm:min-w-[200px] max-w-[200px]">
      <Card className="overflow-hidden">
        <Skeleton className="aspect-square w-full" />
        <div className="p-2.5 space-y-2">
          <Skeleton className="h-2 w-14" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-full" />
        </div>
      </Card>
    </div>
  )
}

function BrandSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
      <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOMEPAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Homepage() {
  const navigate = useNavigationStore(s => s.navigate)

  // ─── Data state ─────────────────────────────────────────────────────────
  const [topLevelCategories, setTopLevelCategories] = useState<Category[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [flashSaleProducts, setFlashSaleProducts] = useState<Product[]>([])
  const [topBrands, setTopBrands] = useState<Brand[]>([])

  const [isLoading, setIsLoading] = useState(true)

  // Fetch all homepage data on mount
  useEffect(() => {
    let cancelled = false
    async function loadData() {
      setIsLoading(true)
      try {
        console.log('📡 Starting homepage data load...')
        const [
          catRes,
          featRes,
          trendRes,
          newArrRes,
          bestRes,
          flashRes,
          brandRes,
        ] = await Promise.all([
          apiGet<{ categories?: Category[]; allCategories?: Category[] }>('/api/categories'),
          apiGet<{ products: ApiProduct[] }>('/api/products?featured=true&limit=8'),
          apiGet<{ products: ApiProduct[] }>('/api/products?trending=true&limit=8'),
          apiGet<{ products: ApiProduct[] }>('/api/products?newArrival=true&limit=8'),
          apiGet<{ products: ApiProduct[] }>('/api/products?bestSeller=true&limit=8'),
          apiGet<{ products: ApiProduct[] }>('/api/products?discount=20&limit=8'),
          apiGet<{ brands: Brand[] }>('/api/brands'),
        ])
        console.log('✅ All APIs responded:', {
          categories: (catRes.categories || catRes.allCategories || []).length,
          featured: featRes.products?.length || 0,
          trending: trendRes.products?.length || 0,
          newArrivals: newArrRes.products?.length || 0,
          bestSellers: bestRes.products?.length || 0,
          flashSale: flashRes.products?.length || 0,
          brands: brandRes.brands?.length || 0,
        })
        if (cancelled) return

        setTopLevelCategories(catRes.categories || catRes.allCategories || [])
        setFeaturedProducts((featRes.products || []).map(normalizeProduct))
        setTrendingProducts((trendRes.products || []).map(normalizeProduct))
        setNewArrivals((newArrRes.products || []).map(normalizeProduct))
        setBestSellers((bestRes.products || []).map(normalizeProduct))
        setFlashSaleProducts((flashRes.products || []).map(normalizeProduct))
        setTopBrands((brandRes.brands || []).slice(0, 12))
        console.log('✅ All state setters called successfully')
      } catch (err) {
        console.error('❌ Homepage data load error:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  // ─── Hero Carousel State ─────────────────────────────────────────────────
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)
  const activeBanners = useMemo(() => banners.filter(b => b.isActive), [])

  const nextSlide = useCallback(() => {
    setHeroIndex(prev => (prev + 1) % (activeBanners.length || 1))
  }, [activeBanners.length])

  const prevSlide = useCallback(() => {
    setHeroIndex(prev => (prev - 1 + activeBanners.length) % (activeBanners.length || 1))
  }, [activeBanners.length])

  useEffect(() => {
    if (heroPaused || activeBanners.length === 0) return
    const timer = setInterval(nextSlide, 5000)
    return () => clearInterval(timer)
  }, [nextSlide, heroPaused, activeBanners.length])

  // ─── Flash Sale Countdown ────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState({ hours: 6, minutes: 0, seconds: 0 })

  useEffect(() => {
    const tick = () => {
      const diff = FLASH_SALE_END.getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  // ─── Review Carousel ─────────────────────────────────────────────────────
  const [reviewIndex, setReviewIndex] = useState(0)
  const reviewsPerView = 3

  const nextReview = useCallback(() => {
    setReviewIndex(prev => (prev + 1) % (reviews.length || 1))
  }, [])

  const prevReview = useCallback(() => {
    setReviewIndex(prev => (prev - 1 + reviews.length) % (reviews.length || 1))
  }, [])

  useEffect(() => {
    if (reviews.length === 0) return
    const timer = setInterval(nextReview, 4000)
    return () => clearInterval(timer)
  }, [nextReview])

  // ─── Newsletter ──────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = () => {
    if (email.includes('@')) {
      setSubscribed(true)
      setEmail('')
      setTimeout(() => setSubscribed(false), 3000)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">

        {/* ═══════════════════ 1. HERO BANNER CAROUSEL ═══════════════════ */}
        <AnimatedSection className="pt-4">
          <div
            className="relative w-full rounded-3xl overflow-hidden shadow-2xl shadow-zinc-900/20 ring-1 ring-zinc-900/5"
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
          >
            <div className="relative h-[260px] sm:h-[360px] md:h-[440px] lg:h-[480px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={heroIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeInOut' }}
                  className="absolute inset-0"
                >
                  {/* Background image */}
                  <motion.img
                    src={activeBanners[heroIndex]?.image}
                    alt={activeBanners[heroIndex]?.title}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 7, ease: 'easeOut' }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Gradient overlay for readability */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${activeBanners[heroIndex]?.bgColor ?? 'from-zinc-900/80 to-zinc-900/60'}`} />
                  {/* Subtle bottom fade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                  {/* Content */}
                  <div className="relative h-full flex items-center px-6 sm:px-12 md:px-16 lg:px-20">
                    <div className="max-w-xl space-y-3 sm:space-y-4">
                      {activeBanners[heroIndex]?.badge && (
                        <motion.span
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15, duration: 0.5 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold tracking-wide uppercase shadow-lg"
                        >
                          <Sparkles size={12} />
                          {activeBanners[heroIndex].badge}
                        </motion.span>
                      )}
                      <motion.h1
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25, duration: 0.5 }}
                        className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] drop-shadow-2xl"
                      >
                        {activeBanners[heroIndex]?.title}
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        className="text-sm sm:text-base md:text-lg text-white/95 font-medium drop-shadow-lg max-w-lg"
                      >
                        {activeBanners[heroIndex]?.subtitle}
                      </motion.p>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55, duration: 0.5 }}
                        className="flex flex-wrap items-center gap-3 pt-1"
                      >
                        <Button
                          size="lg"
                          className="bg-white text-zinc-900 hover:bg-zinc-100 shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all font-bold gap-2 rounded-full px-7 h-12"
                          onClick={() =>
                            navigate(
                              'products',
                              activeBanners[heroIndex]?.category
                                ? { category: activeBanners[heroIndex].category }
                                : undefined
                            )
                          }
                        >
                          {activeBanners[heroIndex]?.cta ?? 'Shop Now'}
                          <ArrowRight size={18} />
                        </Button>
                        <div className="flex items-center gap-2 text-white/90 text-xs sm:text-sm font-medium drop-shadow">
                          <Truck size={16} />
                          <span>Free Delivery over ₹500</span>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/25 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/50 hover:scale-110 transition-all shadow-xl"
              aria-label="Previous slide"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/25 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/50 hover:scale-110 transition-all shadow-xl"
              aria-label="Next slide"
            >
              <ChevronRight size={22} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {activeBanners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === heroIndex ? 'w-8 bg-white shadow-lg' : 'w-2 bg-white/50 hover:bg-white/70'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Slide counter */}
            <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-medium tabular-nums">
              {heroIndex + 1} / {activeBanners.length}
            </div>
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 2. CATEGORY SHOWCASE ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <SectionHeader
            title="Shop by Category"
            subtitle="Browse our top categories"
            icon={<Sparkles size={16} />}
          />
          <HorizontalScroll>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <CategorySkeleton key={i} />)
            ) : topLevelCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 px-4 w-full text-center">
                No categories available.
              </div>
            ) : (
              topLevelCategories.map((cat, i) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -6, scale: 1.05 }}
                  onClick={() => navigate('products', { category: cat.id })}
                  className="flex flex-col items-center gap-2.5 min-w-[90px] sm:min-w-[100px] p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden ring-2 ring-orange-100 dark:ring-orange-900/50 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 group-hover:ring-orange-300 dark:group-hover:ring-orange-700 transition-all">
                    <img
                      src={cat.image || ''}
                      alt={cat.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 text-center leading-tight">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{cat.productCount ?? 0} Products</span>
                </motion.button>
              ))
            )}
          </HorizontalScroll>
        </AnimatedSection>

        {/* ═══════════════════ 3. FLASH SALE SECTION ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <div className="rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 p-[2px]">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg animate-pulse">
                    <Zap size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      Flash Sale
                      <Flame size={22} className="text-orange-500" />
                    </h2>
                    <p className="text-sm text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                      <Zap size={12} /> Selling Fast!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-red-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ends in</span>
                  <div className="flex gap-1.5">
                    {[
                      { val: timeLeft.hours, label: 'H' },
                      { val: timeLeft.minutes, label: 'M' },
                      { val: timeLeft.seconds, label: 'S' },
                    ].map(({ val, label }, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-b from-red-500 to-orange-500 text-white font-bold text-lg flex items-center justify-center shadow-md">
                          {String(val).padStart(2, '0')}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <HorizontalScroll>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <FlashSaleCardSkeleton key={i} />)
                ) : flashSaleProducts.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 px-4 w-full text-center">
                    No flash sale products right now. Check back soon!
                  </div>
                ) : (
                  flashSaleProducts.map((product) => (
                    <div key={product.id} className="min-w-[180px] sm:min-w-[200px] max-w-[200px]">
                      <div className="relative flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-red-100 dark:border-red-900/50 overflow-hidden group cursor-pointer hover:shadow-xl hover:shadow-red-500/10 transition-all"
                        onClick={() => navigate('product-detail', { productId: product.id })}
                      >
                        {/* Stock urgency */}
                        {product.stock <= 15 && (
                          <Badge className="absolute top-1.5 right-1.5 z-10 bg-red-500 text-white border-0 text-[10px] animate-pulse">
                            Only {product.stock} left!
                          </Badge>
                        )}
                        <div className="relative aspect-square bg-gray-50 dark:bg-zinc-800 overflow-hidden">
                          <img src={product.images[0]} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          <Badge className="absolute top-1.5 left-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 text-[11px] font-bold px-2 py-0.5">
                            -{product.discount}%
                          </Badge>
                        </div>
                        <div className="p-2.5 flex flex-col gap-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {product.brand?.name ?? ''}
                          </span>
                          <h3 className="text-xs font-medium line-clamp-2 leading-snug min-h-[2rem]">{product.name}</h3>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatPrice(product.salePrice)}</span>
                            <span className="text-[10px] text-muted-foreground line-through">{formatPrice(product.basePrice)}</span>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-0 text-[11px] font-semibold shadow-md gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              useCartStore.getState().addItem({
                                id: `${product.id}-${Date.now()}`,
                                productId: product.id,
                                name: product.name,
                                image: product.images[0] || '',
                                price: product.basePrice,
                                salePrice: product.salePrice,
                                quantity: 1,
                                stock: product.stock,
                                saveForLater: false,
                              })
                            }}
                          >
                            <ShoppingCart size={12} />
                            Add to Cart
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </HorizontalScroll>
            </div>
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 4. FEATURED PRODUCTS GRID ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <SectionHeader
            title="Featured Products"
            subtitle="Handpicked just for you"
            icon={<Star size={16} />}
            actionLabel="View All"
            onAction={() => navigate('products')}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            ) : featuredProducts.length === 0 ? (
              <div className="col-span-full text-sm text-muted-foreground py-8 text-center">
                No featured products available.
              </div>
            ) : (
              featuredProducts.slice(0, 8).map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))
            )}
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 5. PROMOTIONAL BANNER (MID-PAGE) ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 p-8 sm:p-12 md:p-16">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-xl" />

            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-sm px-4 py-1 mb-4">
                    Limited Time Offer
                  </Badge>
                </motion.div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3 drop-shadow-lg">
                  Mega Sale — Up to 80% Off
                </h2>
                <p className="text-white/90 text-base sm:text-lg max-w-lg">
                  Don&apos;t miss out on incredible deals across electronics, fashion, home & more. Shop now before it&apos;s gone!
                </p>
              </div>
              <Button
                size="lg"
                className="bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-full shadow-2xl hover:shadow-3xl transition-all px-8 text-base gap-2 shrink-0"
                onClick={() => navigate('products')}
              >
                Shop the Sale
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 6. TRENDING PRODUCTS ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <SectionHeader
            title="Trending Now"
            subtitle="What everyone is buying"
            icon={<TrendingUp size={16} />}
            actionLabel="View All"
            onAction={() => navigate('products')}
          />
          <HorizontalScroll>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="min-w-[180px] sm:min-w-[200px] max-w-[200px]">
                  <ProductCardSkeleton />
                </div>
              ))
            ) : trendingProducts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 px-4 w-full text-center">
                No trending products right now.
              </div>
            ) : (
              trendingProducts.slice(0, 12).map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="min-w-[180px] sm:min-w-[200px] max-w-[200px]"
                >
                  <ProductCard
                    product={product}
                    badge={
                      <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 text-[10px] font-bold px-2 py-0.5 shadow-sm">
                        <TrendingUp size={10} className="mr-0.5" />
                        Trending
                      </Badge>
                    }
                  />
                </motion.div>
              ))
            )}
          </HorizontalScroll>
        </AnimatedSection>

        {/* ═══════════════════ 7. TOP BRANDS SECTION ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <SectionHeader
            title="Top Brands"
            subtitle="Shop from your favourite brands"
            icon={<Crown size={16} />}
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
            {isLoading ? (
              Array.from({ length: 12 }).map((_, i) => <BrandSkeleton key={i} />)
            ) : topBrands.length === 0 ? (
              <div className="col-span-full text-sm text-muted-foreground py-8 text-center">
                No brands available.
              </div>
            ) : (
              topBrands.map((brand, i) => (
                <motion.div
                  key={brand.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md hover:shadow-orange-500/5 transition-all cursor-pointer"
                  onClick={() => navigate('products')}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
                    <img src={brand.logo || ''} alt={brand.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 text-center">{brand.name}</span>
                </motion.div>
              ))
            )}
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 8. NEW ARRIVALS ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <SectionHeader
            title="New Arrivals"
            subtitle="Fresh picks just landed"
            icon={<Sparkles size={16} />}
            actionLabel="View All"
            onAction={() => navigate('products')}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            ) : newArrivals.length === 0 ? (
              <div className="col-span-full text-sm text-muted-foreground py-8 text-center">
                No new arrivals yet. Check back soon!
              </div>
            ) : (
              newArrivals.slice(0, 8).map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProductCard
                    product={product}
                    badge={
                      <Badge className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white border-0 text-[10px] font-bold px-2 py-0.5 shadow-sm">
                        NEW
                      </Badge>
                    }
                  />
                </motion.div>
              ))
            )}
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 9. BEST SELLERS ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <SectionHeader
            title="Best Sellers"
            subtitle="Our most popular products"
            icon={<Crown size={16} />}
            actionLabel="View All"
            onAction={() => navigate('products')}
          />
          <HorizontalScroll>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="min-w-[180px] sm:min-w-[200px] max-w-[200px]">
                  <ProductCardSkeleton />
                </div>
              ))
            ) : bestSellers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 px-4 w-full text-center">
                No best sellers yet.
              </div>
            ) : (
              bestSellers.slice(0, 10).map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="min-w-[180px] sm:min-w-[200px] max-w-[200px]"
                >
                  <ProductCard product={product} rank={i + 1} />
                </motion.div>
              ))
            )}
          </HorizontalScroll>
        </AnimatedSection>

        {/* ═══════════════════ 10. CUSTOMER REVIEWS ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <SectionHeader
            title="Customer Reviews"
            subtitle="What our shoppers say"
            icon={<BadgeCheck size={16} />}
          />
          <div className="relative">
            <div className="overflow-hidden">
              <motion.div
                className="flex gap-4"
                animate={{ x: `-${reviewIndex * (100 / reviewsPerView)}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              >
                {reviews.map((review: Review) => (
                  <div
                    key={review.id}
                    className="min-w-[calc(100%/3)] max-w-[calc(100%/3)] px-1"
                    style={{ flexShrink: 0 }}
                  >
                    <div className="flex flex-col h-full p-5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-sm">
                          {review.userName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{review.userName}</p>
                          {review.isVerified && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                              <BadgeCheck size={10} /> Verified Purchase
                            </span>
                          )}
                        </div>
                      </div>
                      <StarRating rating={review.rating} size={13} />
                      <h4 className="text-sm font-semibold mt-2 text-gray-900 dark:text-gray-100">{review.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3 flex-1">{review.comment}</p>
                      <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
                        <span>{review.helpful} found helpful</span>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
            {/* Arrows */}
            <button
              onClick={prevReview}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Previous reviews"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={nextReview}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Next reviews"
            >
              <ChevronRight size={18} />
            </button>
            {/* Dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              {reviews.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setReviewIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === reviewIndex ? 'w-6 bg-orange-500' : 'w-1.5 bg-gray-300 dark:bg-zinc-600'
                  }`}
                  aria-label={`Go to review ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 11. APP DOWNLOAD SECTION ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 via-zinc-900 to-gray-900 p-8 sm:p-12">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Phone mockup */}
              <div className="relative flex-shrink-0">
                <div className="relative w-48 sm:w-56">
                  <div className="w-full aspect-[9/18] rounded-[2rem] border-4 border-gray-700 bg-gradient-to-b from-zinc-800 to-zinc-900 overflow-hidden shadow-2xl shadow-orange-500/20">
                    <div className="flex items-center justify-center pt-6 pb-2">
                      <div className="w-16 h-1 rounded-full bg-gray-600" />
                    </div>
                    <div className="px-3 space-y-2">
                      <div className="h-2 w-3/4 rounded-full bg-orange-500/40" />
                      <div className="h-1.5 w-1/2 rounded-full bg-gray-600" />
                      <div className="grid grid-cols-2 gap-1.5 mt-3">
                        <div className="aspect-square rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-500/30" />
                        <div className="aspect-square rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-500/30" />
                        <div className="aspect-square rounded-lg bg-gradient-to-br from-amber-500/30 to-yellow-500/30" />
                        <div className="aspect-square rounded-lg bg-gradient-to-br from-red-500/30 to-orange-500/30" />
                      </div>
                      <div className="h-1.5 w-2/3 rounded-full bg-gray-600 mt-2" />
                      <div className="h-1.5 w-1/3 rounded-full bg-gray-700" />
                    </div>
                  </div>
                  {/* Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full bg-gray-900 border border-gray-700" />
                </div>
              </div>

              {/* Content */}
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-3">
                  Download the ShopZone App
                </h2>
                <p className="text-gray-400 text-sm sm:text-base max-w-md mb-6">
                  Get exclusive app-only deals, real-time order tracking, and a faster shopping experience. Available on iOS & Android.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* QR Code placeholder */}
                  <div className="w-28 h-28 rounded-xl bg-white p-2 flex flex-col items-center justify-center shadow-lg">
                    <QrCode size={48} className="text-gray-900" />
                    <span className="text-[8px] text-gray-500 mt-1 font-medium">Scan to Download</span>
                  </div>

                  {/* Store buttons */}
                  <div className="flex flex-col gap-2.5">
                    <button className="flex items-center gap-3 px-5 py-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl transition-all group">
                      <Apple size={24} className="text-white" />
                      <div className="text-left">
                        <div className="text-[10px] text-gray-400 leading-none">Download on the</div>
                        <div className="text-sm font-semibold text-white leading-tight">App Store</div>
                      </div>
                    </button>
                    <button className="flex items-center gap-3 px-5 py-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl transition-all group">
                      <Play size={24} className="text-white" />
                      <div className="text-left">
                        <div className="text-[10px] text-gray-400 leading-none">Get it on</div>
                        <div className="text-sm font-semibold text-white leading-tight">Google Play</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* ═══════════════════ 12. NEWSLETTER SECTION ═══════════════════ */}
        <AnimatedSection delay={0.1}>
          <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 p-8 sm:p-12 text-center relative">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/2 translate-x-1/4" />

            <div className="relative max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                Stay in the Loop
              </h2>
              <p className="text-white/90 mb-1 font-medium">
                Get 10% off your first order
              </p>
              <p className="text-white/80 text-sm mb-6">
                Subscribe for exclusive deals, new arrivals & insider-only discounts.
              </p>

              {subscribed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-6 py-3"
                >
                  <BadgeCheck size={20} className="text-white" />
                  <span className="text-white font-semibold">You&apos;re subscribed! Check your inbox.</span>
                </motion.div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                    className="h-12 bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/60 rounded-xl px-5 text-base focus-visible:ring-white/50 focus-visible:border-white/50"
                  />
                  <Button
                    onClick={handleSubscribe}
                    size="lg"
                    className="bg-white text-orange-600 hover:bg-gray-100 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all px-8 shrink-0"
                  >
                    Subscribe
                  </Button>
                </div>
              )}

              <p className="text-white/60 text-[11px] mt-4">No spam, unsubscribe anytime. We respect your privacy.</p>
            </div>
          </div>
        </AnimatedSection>

      </div>
    </div>
  )
}
