import { RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

type SchemaBundle = {
  body?: any;
  query?: any;
  params?: any;
};

const formatError = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

export const validateRequest = (schemas: SchemaBundle): RequestHandler => {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        // Express 5 request properties like body/query/params are getter-only.
        // Parse and attach validated payloads to res.locals instead of mutating req.
        res.locals.validatedBody = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        res.locals.validatedQuery = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        res.locals.validatedParams = schemas.params.parse(req.params);
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', {
          path: req.originalUrl,
          method: req.method,
          errors: formatError(error),
        });
        return res.status(400).json({
          error: 'Invalid request payload',
          details: formatError(error),
        });
      }
      return next(error);
    }
  };
};
