import { Request, Response, NextFunction } from 'express';
type AuthedRequest = Request & {
    user?: {
        id: number;
        role?: string;
    };
};
export declare function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void;
export declare function authenticateJWT(req: AuthedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function rateLimitPerUser(maxPerWindow?: number, windowMs?: number): (req: AuthedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function authenticate(req: any, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRoles(...allowed: Array<'ADMIN' | 'JEFE' | 'BODEGUERO' | 'VENDEDOR'>): (req: any, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export {};
//# sourceMappingURL=middlewares.d.ts.map