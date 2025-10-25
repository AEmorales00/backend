import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true } })
    const roles = await prisma.role.findMany({ select: { id: true, name: true } })
    const ur = await prisma.userRole.findMany({ select: { userId: true, roleId: true } })
    console.log('Users:', users)
    console.log('Roles:', roles)
    console.log('UserRole:', ur)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

