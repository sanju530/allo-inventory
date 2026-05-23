import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { z } from 'zod'

const reservationSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().int().positive(),
})

const RESERVATION_DURATION_MS = 10 * 60 * 1000
const LOCK_TTL_SECONDS = 10

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = reservationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { productId, warehouseId, quantity } = parsed.data

    // Check idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey },
        include: { product: true, warehouse: true },
      })
      if (existing) {
        return NextResponse.json(existing, { status: 200 })
      }
    }

    // Acquire Redis lock
    const lockKey = `lock:stock:${productId}:${warehouseId}`
    const lockValue = crypto.randomUUID()

    const acquired = await redis.set(lockKey, lockValue, {
      nx: true,
      ex: LOCK_TTL_SECONDS,
    })

    if (!acquired) {
      return NextResponse.json(
        { error: 'Another reservation is in progress. Please try again.' },
        { status: 409 }
      )
    }

    try {
      const reservation = await prisma.$transaction(async (tx) => {
        // Find the stock row
        const stock = await tx.stock.findUnique({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
        })

        if (!stock) {
          throw new Error('STOCK_NOT_FOUND')
        }

        const available = stock.total - stock.reserved

        if (available < quantity) {
          throw new Error('INSUFFICIENT_STOCK')
        }

        // Increment reserved count
        await tx.stock.update({
          where: { id: stock.id },
          data: { reserved: { increment: quantity } },
        })

        // Create the reservation
        const newReservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + RESERVATION_DURATION_MS),
            ...(idempotencyKey && { idempotencyKey }),
          },
          include: {
            product: true,
            warehouse: true,
          },
        })

        return newReservation
      })

      return NextResponse.json(reservation, { status: 201 })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
          return NextResponse.json(
            { error: 'Not enough stock available' },
            { status: 409 }
          )
        }
        if (error.message === 'STOCK_NOT_FOUND') {
          return NextResponse.json(
            { error: 'Product not found in this warehouse' },
            { status: 404 }
          )
        }
      }
      throw error
    } finally {
      // Always release the Redis lock
      const currentValue = await redis.get(lockKey)
      if (currentValue === lockValue) {
        await redis.del(lockKey)
      }
    }
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    )
  }
}