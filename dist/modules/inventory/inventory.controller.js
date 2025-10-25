"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const inventory_schema_1 = require("./inventory.schema");
const busboy_1 = __importDefault(require("busboy"));
const csv_parse_1 = require("csv-parse");
const zod_1 = require("zod");
const db_1 = require("../../core/db");
const middlewares_1 = require("../../core/middlewares");
const stream_1 = require("stream");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Zod para fila CSV normalizada
const csvRowSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120),
    description: zod_1.z.string().trim().max(512).optional().or(zod_1.z.literal('').transform(() => undefined)),
    barcode: zod_1.z.string().trim().min(1).max(64).optional().or(zod_1.z.literal('').transform(() => undefined)),
    price: zod_1.z.number().nonnegative().max(999999.99),
    stock: zod_1.z.number().int().nonnegative().max(1000000),
    status: zod_1.z.enum(['Activo', 'Inactivo']).default('Activo'),
});
function normalizePrice(input) {
    if (typeof input === 'number')
        return input;
    if (typeof input !== 'string')
        throw new Error('price inválido');
    const s = input.replace(/\s+/g, '').replace(/,/g, '.');
    const n = Number(s);
    if (!Number.isFinite(n))
        throw new Error('price inválido');
    return n;
}
function normalizeStock(input) {
    if (typeof input === 'number')
        return Math.trunc(input);
    if (typeof input !== 'string')
        throw new Error('stock inválido');
    const s = input.replace(/\s+/g, '');
    const n = Number(s);
    if (!Number.isFinite(n))
        throw new Error('stock inválido');
    return Math.trunc(n);
}
function mapStatusToActive(status) {
    return (status?.toLowerCase() === 'inactivo') ? false : true;
}
function sanitizeStr(v) {
    if (v === undefined || v === null)
        return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
}
function detectDelimiterFromHeader(headerLine) {
    const commas = (headerLine.match(/,/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
}
function parseHeader(headerLine, delimiter) {
    const cols = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());
    return cols;
}
function validateHeader(cols) {
    // Requerimos al menos name; el resto opcional
    if (!cols.includes('name'))
        return { ok: false, message: 'Encabezado debe incluir name' };
    // Opcionales soportados
    const allowed = new Set(['name', 'description', 'barcode', 'price', 'stock', 'status']);
    const unknown = cols.filter((c) => !allowed.has(c));
    if (unknown.length) {
        // Aceptamos columnas extra pero las ignoraremos; no invalidamos
        return { ok: true };
    }
    return { ok: true };
}
function toDecimalString(n) {
    // Garantiza 2 decimales máximo
    return (Math.round(n * 100) / 100).toFixed(2);
}
// Obtener todos (solo activos)
router.get("/", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE', 'BODEGUERO', 'VENDEDOR'), async (req, res) => {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const where = includeInactive ? {} : { active: true };
    const data = await prisma.product.findMany({ where });
    res.json(data);
});
// Obtener por id (solo activos)
router.get("/:id", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE', 'BODEGUERO', 'VENDEDOR'), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID inválido" });
    }
    const item = await prisma.product.findFirst({ where: { id, active: true } });
    if (!item)
        return res.status(404).json({ message: "Producto no encontrado" });
    res.json(item);
});
// Crear uno nuevo
router.post("/", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), async (req, res) => {
    const parsed = inventory_schema_1.createProductSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Datos inválidos", errors: parsed.error.flatten() });
    }
    const { name, description, barcode, price, stock } = parsed.data;
    const desc = typeof description === 'string' ? description : undefined;
    const barc = typeof barcode === 'string' ? barcode : undefined;
    try {
        const item = await prisma.product.create({
            data: { name, description: desc ?? null, barcode: barc ?? null, price, stock },
        });
        res.status(201).json(item);
    }
    catch (e) {
        res.status(500).json({ message: "Error al crear producto" });
    }
});
// ACTUALIZAR (PUT - reemplazo/edición)
router.put("/:id", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), async (req, res) => {
    const id = Number(req.params.id);
    const parsed = inventory_schema_1.updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Datos inválidos", errors: parsed.error.flatten() });
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "Nada que actualizar" });
    }
    try {
        const updated = await prisma.product.update({ where: { id }, data: data });
        res.json(updated);
    }
    catch (e) {
        res.status(404).json({ message: "Producto no encontrado" });
    }
});
// Cambiar estado activo (atajo dedicado)
router.patch("/:id/active", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), async (req, res) => {
    const id = Number(req.params.id);
    const value = String((req.body?.active ?? req.query?.active) ?? '').toLowerCase();
    const active = value === 'true' || value === '1' || value === 'yes' || value === 'on';
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: 'ID inválido' });
    try {
        const result = await prisma.product.update({ where: { id }, data: { active } });
        res.json(result);
    }
    catch (e) {
        res.status(404).json({ message: 'Producto no encontrado' });
    }
});
// ELIMINAR helpers
async function deleteProductById(res, idRaw) {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID inválido" });
    }
    try {
        // Soft delete: marcar como inactivo
        await prisma.product.update({ where: { id }, data: { active: false } });
        return res.status(204).send();
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return res.status(404).json({ message: "Producto no encontrado" });
            }
        }
        console.error('Error al eliminar producto:', e);
        return res.status(500).json({ message: "Error al eliminar producto" });
    }
}
// Soporta DELETE /inventory/:id
router.delete("/:id", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), async (req, res) => {
    return deleteProductById(res, req.params.id);
});
// Soporta DELETE /inventory?id=123
router.delete("/", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), async (req, res) => {
    return deleteProductById(res, req.query.id);
});
// Soporta DELETE /inventory/delete/:id (compatibilidad)
router.delete("/delete/:id", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), async (req, res) => {
    return deleteProductById(res, req.params.id);
});
// Restaurar producto (marcar activo)
router.patch("/:id/restore", middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: 'ID inválido' });
    try {
        const restored = await prisma.product.update({ where: { id }, data: { active: true } });
        res.json(restored);
    }
    catch (e) {
        res.status(404).json({ message: 'Producto no encontrado' });
    }
});
exports.default = router;
// Importación CSV streaming
router.post('/import', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'BODEGUERO'), (0, middlewares_1.rateLimitPerUser)(30, 60000), async (req, res) => {
    const started = Date.now();
    const mode = (req.query.mode === 'upsert') ? 'upsert' : 'insert';
    const dryRun = String((req.query.dryRun ?? 'true')).toLowerCase() === 'true';
    const summary = { total: 0, created: 0, updated: 0, skipped: 0, errors: [], dryRun, mode, durationMs: 0 };
    try {
        const bb = (0, busboy_1.default)({ headers: req.headers, limits: { files: 1, fileSize: 5 * 1024 * 1024 } });
        let handledFile = false;
        bb.on('file', (_name, file, info) => {
            handledFile = true;
            const filename = info.filename;
            const mime = info.mimeType;
            // Detect header line
            let headerDetected = false;
            let headerCols = [];
            let delimiter = ',';
            // Passthrough para reinyectar datos tras separar encabezado
            const replay = new stream_1.PassThrough();
            let buffer = null;
            let headerLine = '';
            let remainder = null;
            file.on('data', (chunk) => {
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
                    if (remainder && remainder.length)
                        replay.write(remainder);
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
            const seenNames = new Set();
            const seenBarcodes = new Set();
            const batch = [];
            const BATCH_SIZE = 500;
            let currentRow = 0; // comienza en 0 para primera fila de datos (después del header)
            async function processBatch(items) {
                if (!items.length)
                    return;
                // Preparar lookup masivo en DB
                const names = Array.from(new Set(items.map(i => i.data.name)));
                const barcodes = Array.from(new Set(items.map(i => i.data.barcode).filter(Boolean)));
                const existing = await db_1.prisma.product.findMany({
                    where: { OR: [{ name: { in: names } }, barcodes.length ? { barcode: { in: barcodes } } : undefined].filter(Boolean) },
                });
                const byName = new Map(existing.map(p => [p.name, p]));
                const byBarcode = new Map(existing.filter(p => p.barcode).map(p => [p.barcode, p]));
                const ops = [];
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
                            ops.push(db_1.prisma.product.create({ data: {
                                    name: d.name,
                                    description: d.description ?? null,
                                    barcode: d.barcode ?? null,
                                    price: toDecimalString(d.price),
                                    stock: d.stock,
                                    active: mapStatusToActive(d.status || 'Activo'),
                                } }));
                        }
                    }
                    else {
                        // upsert
                        if (existingItem) {
                            summary.updated++;
                            if (!dryRun) {
                                const updateData = {
                                    price: toDecimalString(d.price),
                                    stock: d.stock,
                                    active: mapStatusToActive(d.status || 'Activo'),
                                };
                                if (d.description !== undefined)
                                    updateData.description = d.description ?? null;
                                ops.push(db_1.prisma.product.update({ where: { id: existingItem.id }, data: updateData }));
                            }
                        }
                        else {
                            summary.created++;
                            if (!dryRun) {
                                ops.push(db_1.prisma.product.create({ data: {
                                        name: d.name,
                                        description: d.description ?? null,
                                        barcode: d.barcode ?? null,
                                        price: toDecimalString(d.price),
                                        stock: d.stock,
                                        active: mapStatusToActive(d.status || 'Activo'),
                                    } }));
                            }
                        }
                    }
                }
                if (!dryRun && ops.length) {
                    await db_1.prisma.$transaction(ops);
                }
            }
            let parser = null;
            function ensureParser() {
                if (parser)
                    return;
                parser = (0, csv_parse_1.parse)({
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
                    const rec = parser.read();
                    if (!rec)
                        break;
                    currentRow += 1; // fila de datos: 1..N
                    summary.total += 1;
                    try {
                        // Normalizar
                        const name = sanitizeStr(rec.name ?? rec[0]);
                        const description = sanitizeStr(rec.description ?? rec[1]);
                        const barcode = sanitizeStr(rec.barcode ?? rec[2]);
                        const priceRaw = rec.price ?? rec[3];
                        const stockRaw = rec.stock ?? rec[4];
                        const statusRaw = sanitizeStr(rec.status ?? rec[5]);
                        const norm = {
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
                                const zc = issue.code;
                                const code = (zc === 'too_small' || zc === 'too_big') ? 'OUT_OF_RANGE'
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
                        if (d.barcode)
                            seenBarcodes.add(d.barcode);
                        batch.push({ rowNum: currentRow, data: d });
                        if (batch.length >= BATCH_SIZE) {
                            const slice = batch.filter((x) => 'data' in x);
                            await processBatch(slice);
                            batch.length = 0;
                        }
                    }
                    catch (e) {
                        summary.skipped++;
                        summary.errors.push({ row: currentRow, code: 'BAD_FORMAT', message: e?.message || 'Fila inválida' });
                    }
                }
            };
            const onError = (err) => {
                summary.durationMs = Date.now() - started;
                return res.status(400).json({ message: 'CSV inválido', detail: err.message });
            };
            const onEnd = async () => {
                try {
                    const slice = batch.filter((x) => 'data' in x);
                    await processBatch(slice);
                    summary.durationMs = Date.now() - started;
                    // Auditoría simple
                    console.info('[inventory.import]', { userId: req.user?.id, started, ...summary });
                    return res.json(summary);
                }
                catch (e) {
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
    }
    catch (e) {
        summary.durationMs = Date.now() - started;
        return res.status(400).json({ message: 'Error importando CSV', detail: e?.message });
    }
});
//# sourceMappingURL=inventory.controller.js.map