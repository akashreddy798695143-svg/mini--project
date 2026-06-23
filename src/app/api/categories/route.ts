import { NextResponse } from 'next/server'
import { db, withDbRetry } from '@/lib/db'

export async function GET() {
  try {
    const categories = await withDbRetry(() => db.category.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
        children: {
          where: { isActive: true },
          include: {
            _count: {
              select: { products: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }), 3, 1000)

    // Transform to include productCount
    const formatted = categories
      .filter(c => !c.parentId) // Top-level only by default
      .map(category => ({
        ...category,
        productCount: category._count.products,
        children: category.children.map(child => ({
          ...child,
          productCount: child._count.products,
        })),
      }))

    // Also provide all categories (including children) in a flat list
    const allCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      icon: category.icon,
      parentId: category.parentId,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      productCount: category._count.products,
    }))

    return NextResponse.json({
      categories: formatted,
      allCategories,
    })
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
