import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function testLogin() {
  const email = 'admin@tecnova.local'
  
  // Simular lo que hace el controller
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true, status: true },
  } as any)
  
  if (!user) {
    console.error('User not found')
    return
  }
  
  console.log('User found:', { id: user.id, name: user.name, email: user.email })
  
  // cargar roles desde tabla relacional
  let roles: Array<{ role: { name: string } }> = []
  try {
    roles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    }) as any
    console.log('Roles raw from DB:', JSON.stringify(roles, null, 2))
  } catch (e) {
    console.error('Error fetching roles:', e)
  }
  
  const outRoles = roles.map((r) => r.role.name)
  console.log('Roles mapped:', outRoles)
  
  const userOut = {
    id: user.id,
    name: user.name,
    email: user.email,
    status: (user as any).status ?? 'ACTIVO',
    roles: outRoles,
  }
  
  console.log('Final user object:', JSON.stringify(userOut, null, 2))
}

testLogin().catch(console.error).finally(() => prisma.$disconnect())
