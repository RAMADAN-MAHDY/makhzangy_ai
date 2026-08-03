import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import chatRoutes from './routes/chatRoutes.js';
import { notFoundHandler, errorMiddleware } from './middleware/errorMiddleware.js';

export const app = express();

app.set('trust proxy', 1);

// هندلة لينكات متعدده لل origin cors 
const allowedOrigins = env.FRONTEND_ORIGIN.split(',').map(origin => origin.trim());
// طريقة التعامل مع CORS بحيث يسمح لل origins المسموح بها فقط
// 1 - اضف اللينك اللي انت عايزه في env.FRONTEND_ORIGIN
// 2- شكل اللينكات يكون بالشكل ده: http://localhost:3000, https://example.com, https://subdomain.example.com

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

// Prevent runaway Gemini spend from a single client hammering the endpoint.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'استنى شوية قبل ما تبعت رسايل تانية' } },
});

app.get('/', (_req, res) => res.json({ success: true, service: 'makhzangy-ai-backend', status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ success: true, service: 'makhzangy-ai-backend', status: 'ok' }));

app.use('/api/ai', chatLimiter, chatRoutes);

app.use(notFoundHandler);
app.use(errorMiddleware);
