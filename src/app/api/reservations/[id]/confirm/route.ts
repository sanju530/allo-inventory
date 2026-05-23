export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const reservation = await prisma.$transaction(async (tx) => {
      // Find reservation
      const existing = await tx.reservation.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new Error('NOT_FOUND')
      }

      if (existing.status !== 'PENDING') {
        throw new Error(`WRONG_STATUS:${existing.status}`)
      }

      // Check if expired
      if (new Date() > existing.expiresAt) {
        // Auto-release: give the stock back
        await tx.stock.updateMany({
          where: {
            productId: existing.productId,
            warehouseId: existing.warehouseId,
          },
          data: { reserved: { decrement: existing.quantity } },
        })

        await tx.reservation.update({
          where: { id },
          data: { status: 'RELEASED' },
        })

        throw new Error('EXPIRED')
      }

      // Confirm: decrement total stock (purchase is permanent)
      await tx.stock.updateMany({
        where: {
          productId: existing.productId,
          warehouseId: existing.warehouseId,
        },
        data: {
          total: { decrement: existing.quantity },
          reserved: { decrement: existing.quantity },
        },
      })

      return tx.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: { product: true, warehouse: true },
      })
    })

    return NextResponse.json(reservation)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }
      if (error.message === 'EXPIRED') {
        return NextResponse.json({ error: 'Reservation has expired' }, { status: 410 })
      }
      if (error.message.startsWith('WRONG_STATUS')) {
        return NextResponse.json(
          { error: `Reservation is already ${error.message.split(':')[1].toLowerCase()}` },
          { status: 400 }
        )
      }
    }
    console.error('Error confirming reservation:', error)
    return NextResponse.json({ error: 'Failed to confirm reservation' }, { status: 500 })
  }
}