import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data
  await prisma.reservation.deleteMany()
  await prisma.stock.deleteMany()
  await prisma.product.deleteMany()
  await prisma.warehouse.deleteMany()

  // Create warehouses
  const mumbai = await prisma.warehouse.create({
    data: { name: 'Mumbai Central', location: 'Mumbai, Maharashtra' },
  })

  const delhi = await prisma.warehouse.create({
    data: { name: 'Delhi North', location: 'Delhi, NCR' },
  })

  const bangalore = await prisma.warehouse.create({
    data: { name: 'Bangalore Hub', location: 'Bangalore, Karnataka' },
  })

  console.log('✅ Warehouses created')

  // Create products with stock
  const products = [
    {
      name: 'Wireless Noise-Cancelling Headphones',
      description: 'Premium over-ear headphones with 30hr battery life',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    },
    {
      name: 'Mechanical Keyboard',
      description: 'Compact TKL keyboard with Cherry MX switches',
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400',
    },
    {
      name: 'USB-C Hub 7-in-1',
      description: 'Multi-port hub with HDMI, USB 3.0, and SD card reader',
      imageUrl: 'https://images.unsplash.com/photo-1625895197185-efcec01cffe0?w=400',
    },
    {
      name: 'Ergonomic Mouse',
      description: 'Vertical ergonomic mouse, reduces wrist strain',
      imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400',
    },
  ]

  for (const productData of products) {
    const product = await prisma.product.create({ data: productData })

    // Give each product stock in all 3 warehouses
    await prisma.stock.createMany({
      data: [
        { productId: product.id, warehouseId: mumbai.id, total: 10, reserved: 0 },
        { productId: product.id, warehouseId: delhi.id, total: 5, reserved: 0 },
        { productId: product.id, warehouseId: bangalore.id, total: 2, reserved: 0 },
      ],
    })

    console.log(`✅ Created: ${product.name}`)
  }

  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })