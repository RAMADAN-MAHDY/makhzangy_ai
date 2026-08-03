import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

/**
 * Creates an axios instance bound to a single incoming request, so every
 * call a Tool makes to the Main Backend automatically carries the SAME
 * JWT (and therefore the same user/tenant/role) as the person chatting.
 *
 * Design rule (see Core Backend Architecture doc):
 *  - The AI Backend never talks to the Main Backend's MongoDB directly.
 *  - The AI Backend never escalates privileges — it can only do what the
 *    logged-in user is already allowed to do via REST API + JWT.
 */
export function createMainBackendClient(userJwt) {
  const client = axios.create({
    baseURL: env.MAIN_BACKEND_BASE_URL,
    timeout: 15_000,
    headers: {
      Authorization: `Bearer ${userJwt}`,
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err.response?.status || 502;
      const message =
        err.response?.data?.message || err.response?.data?.error || 'Main backend request failed';
      throw new AppError(message, status, 'MAIN_BACKEND_ERROR');
    }
  );

  return client;
}
