import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { healthRouter } from './routes/health.js';

// No side effects here (no migrate/seed/listen) so tests can import this
// directly with Supertest without booting the whole process.
export const app = express();

app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/api', healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);
