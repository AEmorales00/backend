import { Router } from 'express';
import { registerUser } from './user.controller';

const userRouter = Router();

userRouter.post('/users', registerUser);

export default userRouter;
