'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Product } from '@/lib/types'

export default function HomePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data)
    } catch {
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  async function handleReserve(productId: string, warehouseId: string) {
    const key = `${productId}-${warehouseId}`
    setReserving(key)
    setError(null)

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError('Sorry! This item just went out of stock.')
        } else {
          setError(data.error || 'Failed to reserve item')
        }
        return
      }

      // Redirect to reservation page
      router.push(`/reservation/${data.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setReserving(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Allo Inventory</h1>
            <p className="text-sm text-gray-500">Multi-warehouse fulfillment</p>
          </div>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full">
            {products.length} Products
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-800 mb-6">Available Products</h2>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Product Image */}
              {product.imageUrl && (
                <div className="relative h-48 bg-gray-100">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <div className="p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-gray-500 text-sm mb-4">{product.description}</p>
                )}

                {/* Stock per warehouse */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Available Stock by Warehouse
                  </p>
                  {product.stocks.map((stock) => (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {stock.warehouse.name}
                        </p>
                        <p className="text-xs text-gray-500">{stock.warehouse.location}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Stock badge */}
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            stock.available === 0
                              ? 'bg-red-100 text-red-700'
                              : stock.available <= 2
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {stock.available === 0
                            ? 'Out of stock'
                            : `${stock.available} left`}
                        </span>

                        {/* Reserve button */}
                        <button
                          onClick={() => handleReserve(product.id, stock.warehouseId)}
                          disabled={
                            stock.available === 0 ||
                            reserving === `${product.id}-${stock.warehouseId}`
                          }
                          className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                            stock.available === 0
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : reserving === `${product.id}-${stock.warehouseId}`
                              ? 'bg-blue-400 text-white cursor-wait'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {reserving === `${product.id}-${stock.warehouseId}`
                            ? 'Reserving...'
                            : 'Reserve'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}