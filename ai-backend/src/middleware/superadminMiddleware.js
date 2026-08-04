import { createMainBackendClient } from '../utils/mainBackendClient.js';
import { AppError } from '../utils/AppError.js';

export async function superadminMiddleware(req, res, next) {
  try {
    const client = createMainBackendClient(req.userJwt);
    const response = await client.get('/auth/me');
    const role = response.data?.data?.user?.role;

    if (role !== 'superadmin') {
      return next(new AppError('هذة المسار متاح فقط لسوبر أدمن', 403, 'FORBIDDEN'));
    }

    req.userRole = role;
    next();
  } catch (err) {
    next(err);
  }
}
