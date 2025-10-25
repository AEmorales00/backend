import { Request, Response } from 'express';
export declare const registerUser: (req: Request, res: Response) => Promise<void>;
export declare function listUsers(_req: Request, res: Response): Promise<void>;
export declare function setUserRoles(req: Request, res: Response): Promise<void>;
export declare function setUserStatus(req: Request, res: Response): Promise<void>;
export declare function createUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function updateUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function changePassword(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function deleteUser(req: Request, res: Response): Promise<void>;
export declare function getUserById(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=user.controller.d.ts.map