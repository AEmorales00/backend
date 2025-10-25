import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { createProductSchema, updateProductSchema } from "./inventory.schema";
import Busboy from 'busboy';
import { parse as csvParse } from 'csv-parse';
import { z } from 'zod';
import { prisma as prismaSingleton } from '../../core/db';
import { authenticate, rateLimitPerUser, requireRoles } from '../../core/middlewares';
import { PassThrough } from 'stream';

const router = Router();
const prisma = new PrismaClient();

type ImportMode = 'insert' | 'upsert';
type ImportErrorCode = 'BAD_FORMAT' | 'REQUIRED' | 'OUT_OF_RANGE' | 'DUP_IN_FILE' | 'DUP_IN_DB' | 'UPSERT_FAIL';

type RowError = { row: number; column?: string; code: ImportErrorCode; message: string };
type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: RowError[];
  dryRun: boolean;
  mode: ImportMode;
  durationMs: number;
};

// Zod para fila CSV normalizada
const csvRowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(512).optional().or(z.literal('').transform(() => undefined)),
  barcode: z.string().trim().min(1).max(64).optional().or(z.literal('').transform(() => undefined)),
  price: z.number().nonnegative().max(999999.99),
  stock: z.number().int().nonnegative().max(1_000_000),
  status: z.enum(['Activo', 'Inactivo']).default('Activo'),
});

function normalizePrice(input: any): number {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') throw new Error('price inválido');
  const s = input.replace(/\s+/g, '').replace(/,/g, '.');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error('price inválido');
  return n;
}

function normalizeStock(input: any): number {
  if (typeof input === 'number') return Math.trunc(input);
  if (typeof input !== 'string') throw new Error('stock inválido');
  const s = input.replace(/\s+/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error('stock inválido');
  return Math.trunc(n);
}

function mapStatusToActive(status: string | undefined): boolean {
  return (status?.toLowerCase() === 'inactivo') ? false : true;
}

function sanitizeStr(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

function detectDelimiterFromHeader(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function parseHeader(headerLine: string, delimiter: ',' | ';') {
  const cols = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());
  return cols;
}

function validateHeader(cols: string[]): { ok: boolean; message?: string } {
  // Requerimos al menos name; el resto opcional
  if (!cols.includes('name')) return { ok: false, message: 'Encabezado debe incluir name' };
  // Opcionales soportados
  const allowed = new Set(['name', 'description', 'barcode', 'price', 'stock', 'status']);
  const unknown = cols.filter((c) => !allowed.has(c));
  if (unknown.length) {
    // Aceptamos columnas extra pero las ignoraremos; no invalidamos
    return { ok: true };
  }
  return { ok: true };
}

function toDecimalString(n: number): string {
  // Garantiza 2 decimales máximo
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Obtener todos (solo activos)
router.get("/", authenticate, requireRoles('ADMIN','JEFE','BODEGUERO','VENDEDOR'), async (req, res) => {
  const includeInactive = String((req.query as any).includeInactive || '').toLowerCase() === 'true';
  const where = includeInactive ? {} : { active: true };
  const data = await prisma.product.findMany({ where });
  res.json(data);
});

// Obtener por id (solo activos)
router.get("/:id", authenticate, requireRoles('ADMIN','JEFE','BODEGUERO','VENDEDOR'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "ID inválido" });
  }
  const item = await prisma.product.findFirst({ where: { id, active: true } });
  if (!item) return res.status(404).json({ message: "Producto no encontrado" });
  res.json(item);
});

// Crear uno nuevo
router.post("/", authenticate, requireRoles('ADMIN','BODEGUERO'), async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos", errors: parsed.error.flatten() });
  }
  const { name, description, barcode, price, stock } = parsed.data as any;
  const desc: string | undefined = typeof description === 'string' ? description : undefined;
  const barc: string | undefined = typeof barcode === 'string' ? barcode : undefined;
  try {
    const item = await prisma.product.create({
      data: { name, description: desc ?? null, barcode: barc ?? null, price, stock },
    });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ message: "Error al crear producto" });
  }
});

// ACTUALIZAR (PUT - reemplazo/edición)
router.put("/:id", authenticate, requireRoles('ADMIN','BODEGUERO'), async (req, res) => {
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
    const updated = await prisma.product.update({ where: { id }, data: data as any });
    res.json(updated);
  } catch (e) {
    res.status(404).json({ message: "Producto no encontrado" });
  }
});

// Cambiar estado activo (atajo dedicado)
router.patch("/:id/active", authenticate, requireRoles('ADMIN','BODEGUERO'), async (req, res) => {
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
router.delete("/:id", authenticate, requireRoles('ADMIN','BODEGUERO'), async (req, res) => {
  return deleteProductById(res, req.params.id);
});

// Soporta DELETE /inventory?id=123
router.delete("/", authenticate, requireRoles('ADMIN','BODEGUERO'), async (req, res) => {
  return deleteProductById(res, (req.query as any).id);
});

// Soporta DELETE /inventory/delete/:id (compatibilidad)
router.delete("/delete/:id", authenticate, requireRoles('ADMIN','BODEGUERO'), async (req, res) => {
  return deleteProductById(res, req.params.id);
});

// Restaurar producto (marcar activo)
router.patch("/:id/restore", authenticate, requireRoles('ADMIN','BODEGUERO'), async (req, res) => {
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

// Importación CSV streaming
router.post(
  '/import',
  authenticate,
  requireRoles('ADMIN','BODEGUERO'),
  rateLimitPerUser(30, 60_000),
  async (req, res) => {
    const started = Date.now();
    const mode: ImportMode = ((req.query.mode as string) === 'upsert') ? 'upsert' : 'insert';
    const dryRun = String((req.query.dryRun ?? 'true')).toLowerCase() === 'true';
    const summary: ImportSummary = { total: 0, created: 0, updated: 0, skipped: 0, errors: [], dryRun, mode, durationMs: 0 };

    try {
      const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 5 * 1024 * 1024 } });
      let handledFile = false;

      bb.on('file', (_name: any, file: any, info: any) => {
        handledFile = true;
        const filename = info.filename;
        const mime = info.mimeType;
        // Detect header line
        let headerDetected = false;
        let headerCols: string[] = [];
        let delimiter: ',' | ';' = ',';

        // Passthrough para reinyectar datos tras separar encabezado
        const replay = new PassThrough();

        let buffer: Buffer | null = null;
        let headerLine = '';
        let remainder: Buffer | null = null;

        file.on('data', (chunk: Buffer) => {
          if (headerDetected) {
            replay.write(chunk);
            return;
          }
          // Acumular hasta primera línea
          buffer = buffer ? Buffer.concat([buffer, chunk]) : chunk;
          const str = buffer.toString('utf8');
          const idx = str.indexOf('\n');
          if (idx !== -1) {
            headerDetected = true;
            const lineRaw = str.slice(0, idx);
            // soportar CRLF
            headerLine = lineRaw.replace(/\r$/, '');
            const remStr = str.slice(idx + 1);
            remainder = Buffer.from(remStr, 'utf8');

            delimiter = detectDelimiterFromHeader(headerLine);
            headerCols = parseHeader(headerLine, delimiter);
            const hv = validateHeader(headerCols);
            if (!hv.ok) {
              summary.durationMs = Date.now() - started;
              replay.end();
              file.resume();
              return res.status(400).json({ message: 'Archivo inválido', detail: hv.message });
            }
            // Escribimos HEADER + resto y habilitamos parser con columns:true
            const headerWithNewline = Buffer.from(headerLine + '\n', 'utf8');
            replay.write(headerWithNewline);
            if (remainder && remainder.length) replay.write(remainder);

            // Crear parser y conectar
            ensureParser();
          }
        });

        file.on('limit', () => {
          summary.durationMs = Date.now() - started;
          return res.status(400).json({ message: 'Archivo excede 5MB' });
        });

        file.on('end', () => {
          replay.end();
        });

        // Conjuntos para detectar duplicados dentro del archivo
        const seenNames = new Set<string>();
        const seenBarcodes = new Set<string>();

        type Row = { name: string; description?: string | undefined; barcode?: string | undefined; price: number; stock: number; status?: string | undefined };
        const batch: Array<{ rowNum: number; data: Row } | { rowNum: number; error: RowError } > = [];
        const BATCH_SIZE = 500;
        let currentRow = 0; // comienza en 0 para primera fila de datos (después del header)

        async function processBatch(items: Array<{ rowNum: number; data: Row }>) {
          if (!items.length) return;
          // Preparar lookup masivo en DB
          const names = Array.from(new Set(items.map(i => i.data.name)));
          const barcodes = Array.from(new Set(items.map(i => i.data.barcode).filter(Boolean) as string[]));
          const existing = await prismaSingleton.product.findMany({
            where: { OR: [ { name: { in: names } }, barcodes.length ? { barcode: { in: barcodes } } : undefined as any ].filter(Boolean) as any },
          });
          const byName = new Map(existing.map(p => [p.name, p]));
          const byBarcode = new Map(existing.filter(p => p.barcode).map(p => [p.barcode!, p]));

          const ops: Prisma.PrismaPromise<any>[] = [];
          for (const it of items) {
            const d = it.data;
            const matchByBarcode = d.barcode ? byBarcode.get(d.barcode) : undefined;
            const matchByName = byName.get(d.name);
            const existingItem = matchByBarcode || matchByName;

            if (mode === 'insert') {
              if (existingItem) {
                summary.skipped++;
                summary.errors.push({ row: it.rowNum, code: 'DUP_IN_DB', message: 'Ya existe en DB por name o barcode' });
                continue;
              }
              summary.created++;
              if (!dryRun) {
                ops.push(prismaSingleton.product.create({ data: {
                  name: d.name,
                  description: d.description ?? null,
                  barcode: d.barcode ?? null,
                  price: toDecimalString(d.price) as any,
                  stock: d.stock,
                  active: mapStatusToActive(d.status || 'Activo'),
                } }));
              }
            } else {
              // upsert
              if (existingItem) {
                summary.updated++;
                if (!dryRun) {
                  const updateData: Prisma.ProductUpdateInput = {
                    price: toDecimalString(d.price) as any,
                    stock: d.stock,
                    active: mapStatusToActive(d.status || 'Activo'),
                  } as any;
                  if (d.description !== undefined) (updateData as any).description = d.description ?? null;
                  ops.push(prismaSingleton.product.update({ where: { id: existingItem.id }, data: updateData }));
                }
              } else {
                summary.created++;
                if (!dryRun) {
                  ops.push(prismaSingleton.product.create({ data: {
                    name: d.name,
                    description: d.description ?? null,
                    barcode: d.barcode ?? null,
                    price: toDecimalString(d.price) as any,
                    stock: d.stock,
                    active: mapStatusToActive(d.status || 'Activo'),
                  } }));
                }
              }
            }
          }

          if (!dryRun && ops.length) {
            await prismaSingleton.$transaction(ops);
          }
        }

        let parser: ReturnType<typeof csvParse> | null = null;

        function ensureParser() {
          if (parser) return;
          parser = csvParse({
            delimiter,
            columns: true, // usaremos la primera fila como header
            relax_column_count: true,
            skip_empty_lines: true,
            trim: true,
          });

          parser.on('readable', onReadable);
          parser.on('error', onError);
          parser.on('end', onEnd);

          // Conectar replay -> parser
          replay.pipe(parser);
        }

        const onReadable = async () => {
          for (;;) {
            const rec = parser!.read();
            if (!rec) break;
            currentRow += 1; // fila de datos: 1..N
            summary.total += 1;
            try {
              // Normalizar
              const name = sanitizeStr(rec.name ?? rec[0]);
              const description = sanitizeStr(rec.description ?? rec[1]);
              const barcode = sanitizeStr(rec.barcode ?? rec[2]);
              const priceRaw = rec.price ?? rec[3];
              const stockRaw = rec.stock ?? rec[4];
              const statusRaw = sanitizeStr(rec.status ?? rec[5]) as string | undefined;

              const norm: any = {
                name,
                description,
                barcode,
                price: normalizePrice(priceRaw),
                stock: normalizeStock(stockRaw),
                status: statusRaw ?? 'Activo',
              };

              // Validar con Zod
              const parsed = csvRowSchema.safeParse(norm);
              if (!parsed.success) {
                summary.skipped++;
                for (const issue of parsed.error.issues) {
                  const zc = (issue as any).code as string;
                  const code: ImportErrorCode = (zc === 'too_small' || zc === 'too_big') ? 'OUT_OF_RANGE'
                    : (zc === 'invalid_type') ? 'BAD_FORMAT'
                    : (zc === 'invalid_enum_value' || zc === 'invalid_string' || zc === 'custom') ? 'BAD_FORMAT'
                    : 'REQUIRED';
                  summary.errors.push({ row: currentRow, column: issue.path.join('.'), code, message: issue.message });
                }
                continue;
              }

              const d = parsed.data;
              // Detectar duplicados en archivo
              const dupByName = seenNames.has(d.name);
              const dupByBarcode = d.barcode ? seenBarcodes.has(d.barcode) : false;
              if (dupByName || dupByBarcode) {
                summary.skipped++;
                summary.errors.push({ row: currentRow, code: 'DUP_IN_FILE', message: dupByBarcode ? 'barcode duplicado en archivo' : 'name duplicado en archivo' });
                continue;
              }
              seenNames.add(d.name);
              if (d.barcode) seenBarcodes.add(d.barcode);

              batch.push({ rowNum: currentRow, data: d });
              if (batch.length >= BATCH_SIZE) {
                const slice = batch.filter((x: any): x is { rowNum: number; data: Row } => 'data' in x);
                await processBatch(slice);
                batch.length = 0;
              }
            } catch (e: any) {
              summary.skipped++;
              summary.errors.push({ row: currentRow, code: 'BAD_FORMAT', message: e?.message || 'Fila inválida' });
            }
          }
        };

        const onError = (err: any) => {
          summary.durationMs = Date.now() - started;
          return res.status(400).json({ message: 'CSV inválido', detail: err.message });
        };

        const onEnd = async () => {
          try {
            const slice = batch.filter((x: any): x is { rowNum: number; data: Row } => 'data' in x);
            await processBatch(slice);
            summary.durationMs = Date.now() - started;
            // Auditoría simple
            console.info('[inventory.import]', { userId: (req as any).user?.id, started, ...summary });
            return res.json(summary);
          } catch (e: any) {
            summary.durationMs = Date.now() - started;
            return res.status(200).json({ ...summary, errors: [...summary.errors, { row: 0, code: 'UPSERT_FAIL', message: e?.message || 'Error procesando lote' }] });
          }
        };

      });

      bb.on('finish', () => {
        if (!handledFile) {
          summary.durationMs = Date.now() - started;
          return res.status(400).json({ message: 'No se adjuntó archivo CSV' });
        }
      });

      req.pipe(bb);
    } catch (e: any) {
      summary.durationMs = Date.now() - started;
      return res.status(400).json({ message: 'Error importando CSV', detail: e?.message });
    }
  }
);
