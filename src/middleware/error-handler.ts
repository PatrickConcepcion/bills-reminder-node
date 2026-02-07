import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, ApiErrorCode, ErrorFields, zodIssuesToFields } from "../errors";

type ErrorPayload = {
  success: false;
  message: string;
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: ErrorFields;
  };
};

function sendError(res: Response, statusCode: number, code: ApiErrorCode, message: string, fields?: ErrorFields) {
  const payload: ErrorPayload = {
    success: false,
    message,
    error: {
      code,
      message,
      ...(fields ? { fields } : {})
    }
  };

  return res.status(statusCode).json(payload);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} not found`));
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    const fields = zodIssuesToFields(err);
    sendError(res, 400, "VALIDATION_ERROR", "Validation failed", fields);
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.fields);
    return;
  }

  console.error("Unhandled error:", err);
  sendError(res, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
};
