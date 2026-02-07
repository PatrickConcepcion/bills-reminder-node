import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors";

export function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken as string | undefined;
  if (!token) return next(new AppError(401, "UNAUTHENTICATED", "Unauthenticated"));

  const secret = process.env.JWT_SECRET;
  if (!secret) return next(new AppError(500, "INTERNAL_SERVER_ERROR", "JWT_SECRET is not set"));

  try {
    const payload = jwt.verify(token, secret) as { id?: string; sub?: string };
    const userId = payload.id ?? payload.sub;
    if (!userId) return next(new AppError(401, "UNAUTHENTICATED", "Invalid access token"));

    (req as any).userId = userId;
    return next();
  } catch {
    return next(new AppError(401, "UNAUTHENTICATED", "Invalid access token"));
  }
}
