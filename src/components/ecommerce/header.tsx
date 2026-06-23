'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Heart,
  ShoppingCart,
  User,
  Menu,
  X,
  Sun,
  Moon,
  MapPin,
  Phone,
  ChevronDown,
  Truck,
  Package,
  LogIn,
  UserPlus,
  LayoutDashboard,
  PackageCheck,
  Store,
  Shield,
  LogOut,
  Settings,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useNavigationStore } from '@/store/navigation-store'
import { useCartStore } from '@/store/cart-store'
import { useWishlistStore } from '@/store/wishlist-store'
import { useAuthStore } from '@/store/auth-store'
import { useStoreSync } from '@/hooks/use-store-sync'
import { getTopLevelCategories, products } from '@/lib/mock-data'
import { categories as allCategories } from '@/lib/mock-data'
import type { Category } from '@/lib/mock-data'

function getSubcategories(parentId: string): Category[] {
  return allCategories.filter((c) => c.parentId === parentId && c.isActive)
}

function getCategoryProducts(categoryId: string, limit = 4) {
  const subcatIds = allCategories.filter(c => c.parentId === categoryId).map(c => c.id)
  const allIds = [categoryId, ...subcatIds]
  return products.filter(p => allIds.includes(p.categoryId) && p.isActive).slice(0, limit)
}

export function Header() {
  // Auto-sync cart & wishlist from server on auth state changes (login/logout).
  useStoreSync()

  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const navigate = useNavigationStore((s) => s.navigate)
  const setSearchQuery = useNavigationStore((s) => s.setSearchQuery)
  const searchQuery = useNavigationStore((s) => s.searchQuery)
  const currentView = useNavigationStore((s) => s.currentView)
  const cartItemCount = useCartStore(
    (s) => s.items.filter((i) => !i.saveForLater).reduce((sum, i) => sum + i.quantity, 0)
  )
  const wishlistCount = useWishlistStore((s) => s.items.length)
  const { user, isAuthenticated, logout } = useAuthStore()
  const setAuthMode = useNavigationStore((s) => s.setAuthMode)

  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const categoryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const topLevelCategories = useMemo(() => getTopLevelCategories(), [])

  const searchSuggestions = useMemo(() => {
    if (searchQuery.length > 1) {
      const allSuggestions = [
        'Wireless Headphones',
        'Smart Watch',
        'Running Shoes',
        'Laptop Stand',
        'Phone Case',
        'Yoga Mat',
        'Coffee Maker',
        'Backpack',
        'Sunglasses',
        'Bluetooth Speaker',
      ]
      return allSuggestions
        .filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 5)
    }
    return []
  }, [searchQuery])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = mounted ? (resolvedTheme || theme) : 'light'
  const isDarkTheme = currentTheme === 'dark'

  const handleSearch = (query?: string) => {
    const q = query ?? searchQuery
    if (q.trim()) {
      setSearchQuery(q.trim())
      navigate('products', { query: q.trim() })
      setSearchFocused(false)
    }
  }

  const handleCategoryClick = (slug: string) => {
    navigate('products', { category: slug })
    setMobileMenuOpen(false)
  }

  const handleCategoryEnter = (catId: string) => {
    if (categoryTimeoutRef.current) {
      clearTimeout(categoryTimeoutRef.current)
    }
    setActiveCategory(catId)
  }

  const handleCategoryLeave = () => {
    categoryTimeoutRef.current = setTimeout(() => {
      setActiveCategory(null)
    }, 150)
  }

  const toggleTheme = () => {
    setTheme(isDarkTheme ? 'light' : 'dark')
  }

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-background/80 backdrop-blur-xl shadow-lg border-b border-border/50'
          : 'bg-background border-b border-border'
      }`}
    >
      {/* Top Bar */}
      <div className="hidden md:block bg-primary/5 border-b border-border/50">
        <div className="container mx-auto px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Truck className="size-3.5" />
              Free delivery on orders above $50
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              Deliver to: <span className="text-foreground font-medium">New York 10001</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              1-800-SHOPZONE
            </span>
            <Separator orientation="vertical" className="h-3" />
            <button
              onClick={() => navigate('user-dashboard', { tab: 'orders' })}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Package className="size-3.5" />
              Track Order
            </button>
            <Separator orientation="vertical" className="h-3" />
            <button
              onClick={() => navigate('seller-panel')}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Store className="size-3.5" />
              Sell on ShopZone
            </button>
          </div>
        </div>
      </div>

      {/* Main Bar */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3 lg:gap-6">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="size-5" />
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Logo */}
          <motion.button
            onClick={() => navigate('home')}
            className="flex items-center gap-2 shrink-0 group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/40 transition-shadow">
              <span className="text-white font-black text-sm">S</span>
              <div className="absolute -top-0.5 -right-0.5 size-2.5 bg-yellow-400 rounded-full border border-background" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-lg font-black tracking-tight leading-none">
                Shop<span className="text-emerald-600 dark:text-emerald-400">Zone</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase leading-none mt-0.5">
                Marketplace
              </span>
            </div>
          </motion.button>

          {/* Search Bar */}
          <div ref={searchRef} className="flex-1 max-w-2xl relative">
            <div
              className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                searchFocused
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/5'
                  : 'border-border hover:border-emerald-500/50'
              } bg-background`}
            >
              <Search className="size-4 ml-3 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="Search products, brands, and more..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
                className="border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 h-10 bg-transparent text-sm placeholder:text-muted-foreground/70"
              />
              <Button
                onClick={() => handleSearch()}
                size="sm"
                className="mr-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4"
              >
                Search
              </Button>
            </div>

            {/* Search Suggestions Dropdown */}
            <AnimatePresence>
              {searchFocused && searchSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-2">
                    <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Suggestions
                    </p>
                    {searchSuggestions.map((suggestion, i) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setSearchQuery(suggestion)
                          handleSearch(suggestion)
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
                      >
                        <Search className="size-3.5 text-muted-foreground" />
                        <span>{suggestion}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          Popular
                        </Badge>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 lg:gap-2 shrink-0">
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="hidden sm:flex size-10 rounded-xl"
            >
              <AnimatePresence mode="wait" initial={false}>
              {mounted ? (
                isDarkTheme ? (
                  <motion.div
                    key="sun"
                    initial={{ rotate: -90, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    exit={{ rotate: 90, scale: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun className="size-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="moon"
                    initial={{ rotate: -90, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    exit={{ rotate: 90, scale: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon className="size-4" />
                  </motion.div>
                )
              ) : (
                <motion.div
                  key="initial"
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="text-muted-foreground"
                >
                  <Sun className="size-4" />
                </motion.div>
              )}
            </AnimatePresence>
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* User Account */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="hidden sm:flex items-center gap-2 h-10 px-2 rounded-xl"
                >
                  <Avatar className="size-7">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      {isAuthenticated ? userInitials : <User className="size-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[80px] truncate hidden lg:block">
                    {isAuthenticated ? user?.name?.split(' ')[0] : 'Account'}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground hidden lg:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isAuthenticated ? (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate('user-dashboard', { tab: 'profile' })}
                    >
                      <LayoutDashboard className="mr-2 size-4" />
                      My Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('user-dashboard', { tab: 'orders' })}
                    >
                      <PackageCheck className="mr-2 size-4" />
                      My Orders
                    </DropdownMenuItem>
                    {user?.role === 'seller' && (
                      <DropdownMenuItem onClick={() => navigate('seller-panel')}>
                        <Store className="mr-2 size-4" />
                        Seller Panel
                      </DropdownMenuItem>
                    )}
                    {user?.role === 'admin' && (
                      <DropdownMenuItem onClick={() => navigate('admin-panel')}>
                        <Shield className="mr-2 size-4" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => navigate('user-dashboard', { tab: 'settings' })}
                    >
                      <Settings className="mr-2 size-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 size-4" />
                      Log out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel>Welcome to ShopZone</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setAuthMode('login')
                        navigate('auth')
                      }}
                    >
                      <LogIn className="mr-2 size-4" />
                      Sign In
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAuthMode('register')
                        navigate('auth')
                      }}
                    >
                      <UserPlus className="mr-2 size-4" />
                      Create Account
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Wishlist */}
            <Button
              variant="ghost"
              size="icon"
              className="relative size-10 rounded-xl hidden sm:flex"
              onClick={() => navigate('user-dashboard', { tab: 'wishlist' })}
            >
              <Heart className="size-4" />
              {wishlistCount > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 size-4.5 p-0 flex items-center justify-center text-[10px] bg-rose-500 text-white border-2 border-background rounded-full">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </Badge>
              )}
              <span className="sr-only">Wishlist</span>
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative size-10 rounded-xl"
              onClick={() => navigate('cart')}
            >
              <ShoppingCart className="size-4" />
              {cartItemCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 size-4.5 flex items-center justify-center"
                >
                  <Badge className="size-5 p-0 flex items-center justify-center text-[10px] bg-emerald-500 text-white border-2 border-background rounded-full">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Badge>
                </motion.div>
              )}
              <span className="sr-only">Cart</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Category Navigation Bar - Desktop */}
      <div className="hidden lg:block border-t border-border/50 bg-muted/30">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none" role="navigation">
            {topLevelCategories.map((category) => {
              const subcats = getSubcategories(category.id)
              const hasSubcategories = subcats.length > 0

              return (
                <div
                  key={category.id}
                  className="relative"
                  onMouseEnter={() => handleCategoryEnter(category.id)}
                  onMouseLeave={handleCategoryLeave}
                >
                  <button
                    onClick={() => handleCategoryClick(category.slug)}
                    className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeCategory === category.id
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-foreground/80 hover:text-foreground hover:bg-accent/50'
                    }`}
                  >
                    {category.name}
                    {hasSubcategories && (
                      <ChevronDown
                        className={`size-3 transition-transform duration-200 ${
                          activeCategory === category.id ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>

                  {/* Category Dropdown - Mega Menu with Product Images */}
                  <AnimatePresence>
                    {activeCategory === category.id && hasSubcategories && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute top-full left-1/2 -translate-x-1/2 min-w-[520px] bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                        onMouseEnter={() => handleCategoryEnter(category.id)}
                        onMouseLeave={handleCategoryLeave}
                      >
                        <div className="grid grid-cols-2 gap-0">
                          {/* Left: Subcategories */}
                          <div className="p-2 border-r border-border/50">
                            <button
                              onClick={() => handleCategoryClick(category.slug)}
                              className="w-full text-left px-3 py-2 text-sm font-semibold rounded-lg hover:bg-accent flex items-center justify-between transition-colors"
                            >
                              All {category.name}
                              <Badge variant="secondary" className="text-[10px]">
                                {category.productCount}
                              </Badge>
                            </button>
                            <Separator className="my-1" />
                            {subcats.map((sub) => (
                              <button
                                key={sub.id}
                                onClick={() => handleCategoryClick(sub.slug)}
                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent flex items-center justify-between transition-colors"
                              >
                                {sub.name}
                                <span className="text-xs text-muted-foreground">
                                  {sub.productCount}
                                </span>
                              </button>
                            ))}
                          </div>
                          {/* Right: Top Product Images */}
                          <div className="p-2">
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider px-2 mb-1.5">Top Products</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {getCategoryProducts(category.id).map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => navigate('product-detail', { productId: p.id })}
                                  className="group relative rounded-lg overflow-hidden border border-border/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all hover:shadow-md"
                                >
                                  <div className="aspect-square relative bg-muted/50">
                                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    {p.discount > 0 && (
                                      <span className="absolute top-1 left-1 bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">{p.discount}% OFF</span>
                                    )}
                                  </div>
                                  <div className="p-1.5">
                                    <p className="text-[10px] font-medium truncate">{p.name}</p>
                                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">₹{p.salePrice.toLocaleString('en-IN')}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[320px] p-0">
          <div className="flex flex-col h-full">
            {/* Mobile Header */}
            <div className="p-4 border-b border-border bg-gradient-to-br from-emerald-500/10 to-teal-500/5">
              <div className="flex items-center gap-3">
                <div className="relative size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-base">S</span>
                </div>
                <div>
                  <p className="font-bold text-lg leading-none">
                    Shop<span className="text-emerald-600 dark:text-emerald-400">Zone</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Welcome!</p>
                </div>
              </div>
            </div>

            {/* Mobile Search */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch()
                      setMobileMenuOpen(false)
                    }
                  }}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Mobile Categories */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Categories
                </p>
                {topLevelCategories.map((category) => {
                  const subcats = getSubcategories(category.id)
                  return (
                    <MobileCategoryItem
                      key={category.id}
                      category={category}
                      subcategories={subcats}
                      onNavigate={handleCategoryClick}
                    />
                  )
                })}
              </div>

              <Separator />

              <div className="p-3">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Links
                </p>
                <button
                  onClick={() => {
                    navigate('user-dashboard', { tab: 'orders' })
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
                >
                  <Package className="size-4 text-muted-foreground" />
                  Track Order
                </button>
                <button
                  onClick={() => {
                    navigate('seller-panel')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
                >
                  <Store className="size-4 text-muted-foreground" />
                  Sell on ShopZone
                </button>
              </div>

              <Separator />

              <div className="p-3">
                {isAuthenticated ? (
                  <>
                    <button
                      onClick={() => {
                        navigate('user-dashboard')
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
                    >
                      <LayoutDashboard className="size-4 text-muted-foreground" />
                      My Dashboard
                    </button>
                    <button
                      onClick={() => {
                        logout()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent flex items-center gap-3 text-rose-600 transition-colors"
                    >
                      <LogOut className="size-4" />
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setAuthMode('login')
                        navigate('auth')
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
                    >
                      <LogIn className="size-4 text-muted-foreground" />
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        setAuthMode('register')
                        navigate('auth')
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
                    >
                      <UserPlus className="size-4 text-muted-foreground" />
                      Create Account
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Truck className="size-3.5" />
                  Free delivery $50+
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="gap-1.5 text-xs"
                >
                  {mounted ? (
                    isDarkTheme ? (
                      <Sun className="size-3.5" />
                    ) : (
                      <Moon className="size-3.5" />
                    )
                  ) : (
                    <Sun className="size-3.5" />
                  )}
                  {mounted ? (isDarkTheme ? 'Light' : 'Dark') : 'Dark'}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

function MobileCategoryItem({
  category,
  subcategories,
  onNavigate,
}: {
  category: Category
  subcategories: Category[]
  onNavigate: (slug: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => onNavigate(category.slug)}
          className="flex-1 text-left px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
        >
          {category.name}
        </button>
        {subcategories.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}
      </div>
      <AnimatePresence>
        {expanded && subcategories.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-6 pb-1">
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => onNavigate(sub.slug)}
                  className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg flex items-center justify-between transition-colors"
                >
                  {sub.name}
                  <span className="text-xs">{sub.productCount}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Header
