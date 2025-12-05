import express, { Request, Response, Express } from 'express';
import { logger } from './utils/logger';

const app: Express = express();

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'Backend running' });
});

// Add your private logic here (not exposed as routes)

app.listen(4000, () => {
  logger.info('Backend listening on port 4000');
});