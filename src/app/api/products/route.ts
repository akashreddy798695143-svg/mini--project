import { NextRequest, NextResponse } from 'next/server'
import { db, withDbRetry } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const sort = searchParams.get('sort') || 'createdAt_desc'
    const search = searchParams.get('search')
    const rating = searchParams.get('rating')
    const discount = searchParams.get('discount')
    const featured = searchParams.get('featured')
    const newArrival = searchParams.get('newArrival')
    const trending = searchParams.get('trending')
    const bestSeller = searchParams.get('bestSeller')

    const skip = (page - 1) * limit

    // Auto-seed the database on first access if it's empty
    const productCount = await withDbRetry(() => db.product.count(), 3, 1000)
    if (productCount === 0) {
      try {
        const origin = request.nextUrl.origin
        await fetch(`${origin}/api/seed`, { method: 'GET' })
      } catch (e) {
        console.error('Auto-seed failed:', e)
      }
    }

    // Build where clause
    const where: Record<string, unknown> = { isActive: true }

    if (category) {
      // Check if it's a slug or id
      const cat = await db.category.findFirst({
        where: {
          OR: [{ slug: category }, { id: category }],
        },
      })
      if (cat) {
        // Include child categories
        const childCategories = await db.category.findMany({
          where: { parentId: cat.id },
          select: { id: true },
        })
        const categoryIds = [cat.id, ...childCategories.map(c => c.id)]
        where.categoryId = { in: categoryIds }
      }
    }

    if (brand) {
      const brandRecord = await db.brand.findFirst({
        where: {
          OR: [{ slug: brand }, { id: brand }],
        },
      })
      if (brandRecord) {
        where.brandId = brandRecord.id
      }
    }

    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {}
      if (minPrice) priceFilter.gte = parseFloat(minPrice)
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice)
      where.salePrice = priceFilter
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { shortDesc: { contains: search } },
        { tags: { contains: search } },
      ]
    }

    if (rating) {
      where.avgRating = { gte: parseFloat(rating) }
    }

    if (discount) {
      where.discount = { gte: parseFloat(discount) }
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    if (newArrival === 'true') {
      where.isNewArrival = true
    }

    if (trending === 'true') {
      where.isTrending = true
    }

    if (bestSeller === 'true') {
      where.isBestSeller = true
    }

    // Build order by
    const orderBy: Record<string, string> = {}
    switch (sort) {
      case 'price_asc':
        orderBy.salePrice = 'asc'
        break
      case 'price_desc':
        orderBy.salePrice = 'desc'
        break
      case 'name_asc':
        orderBy.name = 'asc'
        break
      case 'name_desc':
        orderBy.name = 'desc'
        break
      case 'rating_desc':
        orderBy.avgRating = 'desc'
        break
      case 'newest':
        orderBy.createdAt = 'desc'
        break
      case 'popularity':
        orderBy.totalSold = 'desc'
        break
      case 'discount_desc':
        orderBy.discount = 'desc'
        break
      default:
        orderBy.createdAt = 'desc'
    }

      const [products, total] = await Promise.all([
      withDbRetry(() => db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true, logo: true } },
          seller: { select: { id: true, storeName: true, storeSlug: true, rating: true, isVerified: true } },
          reviews: { select: { id: true, rating: true }, take: 5 },
        },
        orderBy,
        skip,
        take: limit,
      }), 3, 1000),
      withDbRetry(() => db.product.count({ where }), 3, 1000),
    ])

    return NextResponse.json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
