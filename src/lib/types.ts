export type Warehouse = {
  id: string
  name: string
  location: string
}

export type Stock = {
  id: string
  productId: string
  warehouseId: string
  total: number
  reserved: number
  available: number
  warehouse: Warehouse
}

export type Product = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  stocks: Stock[]
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED'

export type Reservation = {
  id: string
  productId: string
  warehouseId: string
  quantity: number
  status: ReservationStatus
  expiresAt: string
  createdAt: string
  product: Product
  warehouse: Warehouse
}