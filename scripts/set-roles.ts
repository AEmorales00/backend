import { PrismaClient, RoleName } from '@prisma/client'

function parseArgs() {
  const args = process.argv.slice(2)
  const out: Record<string, string | string[]> = {}
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/)
    if (m) {
      const k = m[1]
      const v = m[2]
      out[k] = v
    } else if (a.startsWith('--')) {
      const k = a.replace(/^--/, '')
      out[k] = 'true'
    }
  }
  return out
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const args = parseArgs()
    const emailRaw = String(args.email || '')
    const rolesArg = String(args.roles || '')
    if (!emailRaw || !rolesArg) {
      console.error('Usage: ts-node scripts/set-roles.ts --email=user@example.com --roles=ADMIN,JEFE')
      process.exit(1)
    }
    const email = emailRaw.trim().toLowerCase()
    const roles = rolesArg.split(',').map(s => s.trim().toUpperCase()) as RoleName[]

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.error('User not found:', email)
      process.exit(2)
    }

    const roleRows = await prisma.role.findMany({ where: { name: { in: roles } } })
    if (!roleRows.length) {
      console.error('No matching roles found in DB for:', roles)
      process.exit(3)
    }

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: user.id } }),
      prisma.userRole.createMany({ data: roleRows.map(r => ({ userId: user.id, roleId: r.id })) }),
    ])

    const check = await prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    })

    console.log('OK roles set for', email, '=>', check?.roles.map(r => r.role.name))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

