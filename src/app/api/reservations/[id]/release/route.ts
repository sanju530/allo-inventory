import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
){
  try {
    const { id } = await params

    const reservation = await prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new Error('NOT_FOUND')
      }

      if (existing.status !== 'PENDING') {
        throw new Error(`WRONG_STATUS:${existing.status}`)
      }

      // Give the stock back
      await tx.stock.updateMany({
        where: {
          productId: existing.productId,
          warehouseId: existing.warehouseId,
        },
        data: { reserved: { decrement: existing.quantity } },
      })

      return tx.reservation.update({
        where: { id },
        data: { status: 'RELEASED' },
        include: { product: true, warehouse: true },
      })
    })

    return NextResponse.json(reservation)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }
      if (error.message.startsWith('WRONG_STATUS')) {
        return NextResponse.json(
          { error: `Reservation is already ${error.message.split(':')[1].toLowerCase()}` },
          { status: 400 }
        )
      }
    }
    console.error('Error releasing reservation:', error)
    return NextResponse.json({ error: 'Failed to release reservation' }, { status: 500 })
  }
}