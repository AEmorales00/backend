import { PrismaClient, RoleName, UserStatus } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function upsertRole(name: RoleName) {
  return prisma.role.upsert({ where: { name }, update: {}, create: { name } })
}

async function assignRole(userId: number, roleName: RoleName) {
  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (!role) return
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  })
}

async function main() {
  for (const r of [RoleName.ADMIN, RoleName.JEFE, RoleName.BODEGUERO, RoleName.VENDEDOR]) {
    await upsertRole(r)
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@tecnova.local' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@tecnova.local',
      passwordHash: await bcrypt.hash('Admin123!', 10),
      status: UserStatus.ACTIVO,
    },
  })
  await assignRole(admin.id, RoleName.ADMIN)

  const bode = await prisma.user.upsert({
    where: { email: 'bodega@tecnova.local' },
    update: {},
    create: {
      name: 'Bodeguero',
      email: 'bodega@tecnova.local',
      passwordHash: await bcrypt.hash('Bodega123!', 10),
      status: UserStatus.ACTIVO,
    },
  })
  await assignRole(bode.id, RoleName.BODEGUERO)

  const vend = await prisma.user.upsert({
    where: { email: 'ventas@tecnova.local' },
    update: {},
    create: {
      name: 'Vendedor',
      email: 'ventas@tecnova.local',
      passwordHash: await bcrypt.hash('Ventas123!', 10),
      status: UserStatus.ACTIVO,
    },
  })
  await assignRole(vend.id, RoleName.VENDEDOR)

  const jefe = await prisma.user.upsert({
    where: { email: 'jefe@tecnova.local' },
    update: {},
    create: {
      name: 'Jefe',
      email: 'jefe@tecnova.local',
      passwordHash: await bcrypt.hash('Jefe123!', 10),
      status: UserStatus.ACTIVO,
    },
  })
  await assignRole(jefe.id, RoleName.JEFE)

  // Productos de ejemplo (solo si no existen por nombre)
  const products: Array<{ name: string; description?: string; price: number; stock: number } > = [
    { name: 'Laptop HP Pavilion', description: 'Core i5, 8GB RAM, 512GB SSD', price: 650.00, stock: 10 },
    { name: 'Mouse Logitech M90', description: 'Óptico USB', price: 12.00, stock: 49 },
    { name: 'Teclado Mecánico Redragon', description: 'Switch Blue', price: 45.00, stock: 20 },
    { name: 'Monitor Samsung 24"', description: 'Full HD HDMI', price: 180.00, stock: 15 },
    { name: 'Impresora Epson L3250', description: 'Multifuncional', price: 210.00, stock: 12 },
    { name: 'Disco Duro Seagate 1TB', description: 'USB 3.0', price: 60.00, stock: 30 },
    { name: 'SSD Kingston 500GB', description: 'NVMe M.2', price: 55.00, stock: 22 },
    { name: 'Parlantes Logitech Z313', description: '2.1 canales', price: 45.00, stock: 16 },
    { name: 'Cámara Logitech C920', description: 'Full HD', price: 95.00, stock: 22 },
    { name: 'Fuente EVGA 600W', description: '80 Plus Bronze', price: 55.00, stock: 30 },
    { name: 'Router TP-Link Archer', description: 'WiFi 6', price: 70.00, stock: 28 },
    { name: 'Tablet Lenovo M10', description: '10.1" 64GB', price: 180.00, stock: 10 },
  ]
  for (const p of products) {
    const exists = await prisma.product.findFirst({ where: { name: p.name } })
    if (!exists) {
      await prisma.product.create({ data: { name: p.name, description: p.description ?? null, price: p.price as any, stock: p.stock } })
    }
  }

  console.log('Seed OK (roles, usuarios, productos)')
}

main().catch(console.error).finally(()=>prisma.$disconnect())
