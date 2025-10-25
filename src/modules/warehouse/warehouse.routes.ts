import { Router } from 'express';
import { listPurchases, createPurchase } from './warehouse.controller';
import { authenticate, requireRoles } from '../../core/middlewares';

const router = Router();

router.use(authenticate as any);

router.get('/purchases', requireRoles('BODEGUERO', 'ADMIN') as any, listPurchases as any);
router.post('/purchases', requireRoles('BODEGUERO', 'ADMIN') as any, createPurchase as any);

export default router;

