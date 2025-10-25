import { CreatePurchaseDto } from './warehouse.schema';
export declare class WarehouseService {
    listPurchases(_params?: {
        from?: Date;
        to?: Date;
        q?: string;
    }): Promise<({
        user: {
            id: number;
            email: string;
            name: string;
            passwordHash: string;
            role: string | null;
            status: import(".prisma/client").$Enums.UserStatus;
            createdAt: Date;
            updatedAt: Date;
        };
        items: ({
            product: {
                id: number;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                barcode: string | null;
                price: import("@prisma/client/runtime/library").Decimal;
                stock: number;
                active: boolean;
                cost: import("@prisma/client/runtime/library").Decimal;
            };
        } & {
            id: number;
            quantity: number;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            productId: number;
            unitCost: import("@prisma/client/runtime/library").Decimal;
            purchaseId: number;
        })[];
        supplier: {
            id: number;
            email: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            nit: string | null;
            phone: string | null;
        } | null;
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        supplierId: number | null;
        note: string | null;
        totalCost: import("@prisma/client/runtime/library").Decimal;
    })[]>;
    createPurchase(userId: number, dto: CreatePurchaseDto): Promise<({
        user: {
            id: number;
            email: string;
            name: string;
            passwordHash: string;
            role: string | null;
            status: import(".prisma/client").$Enums.UserStatus;
            createdAt: Date;
            updatedAt: Date;
        };
        items: ({
            product: {
                id: number;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                barcode: string | null;
                price: import("@prisma/client/runtime/library").Decimal;
                stock: number;
                active: boolean;
                cost: import("@prisma/client/runtime/library").Decimal;
            };
        } & {
            id: number;
            quantity: number;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            productId: number;
            unitCost: import("@prisma/client/runtime/library").Decimal;
            purchaseId: number;
        })[];
        supplier: {
            id: number;
            email: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            nit: string | null;
            phone: string | null;
        } | null;
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        supplierId: number | null;
        note: string | null;
        totalCost: import("@prisma/client/runtime/library").Decimal;
    }) | null>;
}
//# sourceMappingURL=warehouse.service.d.ts.map