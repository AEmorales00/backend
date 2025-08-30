import { Request, Response } from 'express';

// Placeholder functions until TestCase model is implemented
export async function createTestCase(req: Request, res: Response) {
  res.status(501).json({ message: 'TestCase functionality not yet implemented' });
}

export async function listTestCases(_req: Request, res: Response) {
  res.status(501).json({ message: 'TestCase functionality not yet implemented' });
}
