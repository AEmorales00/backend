import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { createProductSchema, updateProductSchema } from "./inventory.schema";

const router = Router();
const prisma = new PrismaClient();

// Obtener todos (solo activos)
router.get("/", async (req, res) => {
  const includeInactive = String((req.query as any).includeInactive || '').toLowerCase() === 'true';
  const where = includeInactive ? {} : { active: true };
  const data = await prisma.product.findMany({ where });
  res.json(data);
});

// Obtener por id (solo activos)
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "ID inválido" });
  }
  const item = await prisma.product.findFirst({ where: { id, active: true } });
  if (!item) return res.status(404).json({ message: "Producto no encontrado" });
  res.json(item);
});

// Crear uno nuevo
router.post("/", async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos", errors: parsed.error.flatten() });
  }
  const { name, description, barcode, price, stock } = parsed.data;
  try {
    const item = await prisma.product.create({
      data: { name, description, barcode, price, stock },
    });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ message: "Error al crear producto" });
  }
});

// ACTUALIZAR (PUT - reemplazo/edición)
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos", errors: parsed.error.flatten() });
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nada que actualizar" });
  }
  try {
    const updated = await prisma.product.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    res.status(404).json({ message: "Producto no encontrado" });
  }
});

// Cambiar estado activo (atajo dedicado)
router.patch("/:id/active", async (req, res) => {
  const id = Number(req.params.id);
  const value = String((req.body?.active ?? req.query?.active) ?? '').toLowerCase();
  const active = value === 'true' || value === '1' || value === 'yes' || value === 'on';
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });
  try {
    const result = await prisma.product.update({ where: { id }, data: { active } });
    res.json(result);
  } catch (e) {
    res.status(404).json({ message: 'Producto no encontrado' });
  }
});

// ELIMINAR helpers
async function deleteProductById(res: any, idRaw: any) {
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "ID inválido" });
  }
  try {
    // Soft delete: marcar como inactivo
    await prisma.product.update({ where: { id }, data: { active: false } });
    return res.status(204).send();
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
    }
    console.error('Error al eliminar producto:', e);
    return res.status(500).json({ message: "Error al eliminar producto" });
  }
}

// Soporta DELETE /inventory/:id
router.delete("/:id", async (req, res) => {
  return deleteProductById(res, req.params.id);
});

// Soporta DELETE /inventory?id=123
router.delete("/", async (req, res) => {
  return deleteProductById(res, (req.query as any).id);
});

// Soporta DELETE /inventory/delete/:id (compatibilidad)
router.delete("/delete/:id", async (req, res) => {
  return deleteProductById(res, req.params.id);
});

// Restaurar producto (marcar activo)
router.patch("/:id/restore", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });
  try {
    const restored = await prisma.product.update({ where: { id }, data: { active: true } });
    res.json(restored);
  } catch (e) {
    res.status(404).json({ message: 'Producto no encontrado' });
  }
});


export default router;
