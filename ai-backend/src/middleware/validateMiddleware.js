import { AppError } from '../utils/AppError.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }

    req[source] = result.data;
    next();
  };
}
