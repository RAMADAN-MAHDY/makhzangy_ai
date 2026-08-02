import { fileURLToPath } from 'url';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

async function start() {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`🤖 Makhzangy AI Backend running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'Unhandled Rejection — shutting down');
    server.close(() => process.exit(1));
  });
}

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1];

if (executedFile === currentFile) {
  start();
}

export default app;
