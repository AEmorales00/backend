import { Request, Response } from 'express';
import { WarehouseService } from './warehouse.service';
import { createPurchaseDto } from './warehouse.schema';

const service = new WarehouseService();

export async function listPurchases(req: Request, res: Response) {
  const data = await service.listPurchases();
  res.json(data);
}

export async function createPurchase(req: Request, res: Response) {
  const parsed = createPurchaseDto.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const userId = (req as any).user?.sub;
  const purchase = await service.createPurchase(Number(userId), parsed.data);
  res.status(201).json(purchase);
}

