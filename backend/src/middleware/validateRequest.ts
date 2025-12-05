import { RequestHandler } from 'express';
import { ZodSchema, ZodTypeAny, ZodError } from 'zod';
import { logger } from '../utils/logger';

interface SchemaBundle {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

const formatError = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

export const validateRequest = (schemas: SchemaBundle): RequestHandler => {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
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
