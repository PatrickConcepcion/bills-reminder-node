import { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR";

export type ErrorFields = Record<string, string[]>;

export class AppError extends Error {
  statusCode: number;
  code: ApiErrorCode;
  fields?: ErrorFields;

  constructor(statusCode: number, code: ApiErrorCode, message: string, fields?: ErrorFields) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

export function zodIssuesToFields(error: ZodError): ErrorFields {
  const fields: ErrorFields = {};

  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join(".") : "root";
    if (!fields[path]) fields[path] = [];
    fields[path].push(issue.message);
  }

  return fields;
}
