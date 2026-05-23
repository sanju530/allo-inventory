'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Reservation } from '@/lib/types'

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!expiresAt) return

    function update() {
      const diff = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return { secondsLeft, minutes, seconds }
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvedId, setResolvedId] = useState<string | null>(null)

  const { secondsLeft, minutes, seconds } = useCountdown(
    reservation?.status === 'PENDING' ? reservation.expiresAt : null
  )

  useEffect(() => {
    params.then(({ id }) => setResolvedId(id))
  }, [params])

  const fetchReservation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setReservation(data)
    } catch {
      setError('Reservation not found')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (resolvedId) fetchReservation(resolvedId)
  }, [resolvedId, fetchReservation])

  async function handleConfirm() {
    if (!resolvedId) return
    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/reservations/${resolvedId}/confirm`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 410) {
          setError('Your reservation has expired. The item has been released back to stock.')
        } else {
          setError(data.error || 'Failed to confirm')
        }
        fetchReservation(resolvedId)
        return
      }

      setReservation(data)
    } catch {
      setError('Something went wrong.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!resolvedId) return
    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/reservations/${resolvedId}/release`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to cancel')
        return
      }

      setReservation(data)
    } catch {
      setError('Something went wrong.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reservation...</p>
        </div>
      </div>
    )
  }

  if (error && !reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-blue-600 underline"
          >
            Back to products
          </button>
        </div>
      </div>
    )
  }

  const isExpired = reservation?.status === 'PENDING' && secondsLeft === 0
  const isPending = reservation?.status === 'PENDING' && !isExpired
  const isConfirmed = reservation?.status === 'CONFIRMED'
  const isReleased = reservation?.status === 'RELEASED' || isExpired

  const timerColor =
    secondsLeft > 120 ? 'text-green-600' : secondsLeft > 60 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* Status Banner */}
        {isConfirmed && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h2 className="text-xl font-bold text-green-800">Purchase Confirmed!</h2>
            <p className="text-green-600 mt-1">Your order has been placed successfully.</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        )}

        {isReleased && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">🔓</div>
            <h2 className="text-xl font-bold text-gray-800">Reservation Released</h2>
            <p className="text-gray-500 mt-1">
              {isExpired ? 'Your reservation expired.' : 'You cancelled this reservation.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Products
            </button>
          </div>
        )}

        {/* Reservation Details Card */}
        {reservation && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Product</p>
                  <h2 className="text-xl font-bold text-gray-900">{reservation.product.name}</h2>
                  {reservation.product.description && (
                    <p className="text-gray-500 text-sm mt-1">{reservation.product.description}</p>
                  )}
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    isConfirmed
                      ? 'bg-green-100 text-green-700'
                      : isReleased
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {reservation.status}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Warehouse</p>
                  <p className="font-semibold text-gray-800">{reservation.warehouse.name}</p>
                  <p className="text-xs text-gray-500">{reservation.warehouse.location}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Quantity</p>
                  <p className="font-semibold text-gray-800">{reservation.quantity} unit(s)</p>
                </div>
              </div>

              {/* Countdown Timer */}
              {isPending && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Time Remaining
                  </p>
                  <p className={`text-4xl font-mono font-bold ${timerColor}`}>
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Item held until{' '}
                    {new Date(reservation.expiresAt).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isPending && (
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={actionLoading}
                  className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
                >
                  {actionLoading ? 'Processing...' : '✓ Confirm Purchase'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="flex-1 bg-white text-gray-700 font-semibold py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  ✕ Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}