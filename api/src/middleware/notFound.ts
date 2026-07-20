import { Request, Response } from 'express';
import { ErrorCode, createErrorResponse } from '../types/api-responses';

export const notFound = (req: Request, res: Response): void => {
  const errorResponse = createErrorResponse(
    ErrorCode.NOT_FOUND,
    `Route ${req.originalUrl} not found`
  );

  res.status(404).json(errorResponse);
};

export default notFound;