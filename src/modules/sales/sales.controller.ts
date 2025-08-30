import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createSaleSchema } from './sales.schema';

const router = Router();
const prisma = new PrismaClient();

// Crear venta
router.post('/', async (req, res) => {
  const parsed = createSaleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.flatten() });
  }

  const { items } = parsed.data;

  // Cargar productos involucrados
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, active: true } });
  const map = new Map(products.map((p) => [p.id, p]));

  // Validaciones de existencia y stock
  for (const i of items) {
    const p = map.get(i.productId);
    if (!p) return res.status(400).json({ message: `Producto ${i.productId} no existe o está inactivo` });
    if (p.stock < i.quantity) {
      return res.status(400).json({ message: `Stock insuficiente para producto ${p.id}` });
    }
  }

  // Calcular precios y totales
  const computed = items.map((i) => {
    const p = map.get(i.productId)!;
    const price = i.price ?? Number(p.price);
    const subtotal = Number((price * i.quantity).toFixed(2));
    return { ...i, price, subtotal };
  });
  const total = Number(computed.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({ data: { total } });

      await tx.saleItem.createMany({
        data: computed.map((i) => ({
          saleId: sale.id,
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.subtotal,
        })),
      });

      // Descontar stock
      for (const i of computed) {
        await tx.product.update({
          where: { id: i.productId },
          data: { stock: { decrement: i.quantity } },
        });
      }

      return sale;
    });

    res.status(201).json({ id: result.id, total });
  } catch (e) {
    console.error('Error al registrar venta:', e);
    res.status(500).json({ message: 'Error al registrar venta' });
  }
});

// Listar ventas (resumen)
router.get('/', async (_req, res) => {
  const sales = await prisma.sale.findMany({ orderBy: { createdAt: 'desc' } });
  const out = sales.map((s) => ({ id: s.id, createdAt: s.createdAt, total: parseFloat(s.total.toString()) }));
  res.json(out);
});

// Obtener venta por id (con items)
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });
  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!sale) return res.status(404).json({ message: 'Venta no encontrada' });

    const items = sale.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.product?.name ?? null,
      price: parseFloat(it.price.toString()),
      quantity: it.quantity,
      subtotal: parseFloat(it.subtotal.toString()),
    }));
    const total = parseFloat(sale.total.toString());
    const response = {
      id: sale.id,
      createdAt: sale.createdAt,
      total,
      totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
      items,
    };
    res.json(response);
  } catch (e) {
    console.error('Error obteniendo venta:', e);
    res.status(500).json({ message: 'Error interno' });
  }
});

export async function getSaleItems(req: Request, res: Response) {
  const idRaw = req.params.id ?? req.query.saleId;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'saleId inválido' });
  try {
    const items = await prisma.saleItem.findMany({
      where: { saleId: id },
      include: { product: true },
      orderBy: { id: 'asc' },
    });
    const out = items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.product?.name ?? null,
      price: parseFloat(it.price.toString()),
      quantity: it.quantity,
      subtotal: parseFloat(it.subtotal.toString()),
    }));
    res.json(out);
  } catch (e) {
    console.error('Error obteniendo items de venta:', e);
    res.status(500).json({ message: 'Error interno' });
  }
}

// Aliases dentro de /sales
router.get('/:id/items', getSaleItems);
router.get('/items', getSaleItems);

export default router;
