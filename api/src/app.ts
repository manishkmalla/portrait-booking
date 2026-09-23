import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { bookingsRouter } from './routes/bookings.js';
import { healthRouter } from './routes/health.js';
import { slotsRouter } from './routes/slots.js';

// No side effects here (no migrate/seed/listen) so tests can import this
// directly with Supertest without booting the whole process.
export const app = express();

app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/bookings', bookingsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
