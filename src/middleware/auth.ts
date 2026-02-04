import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken as string | undefined;
  if (!token) return res.status(401).json({ message: "Unauthenticated" });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ message: "JWT_SECRET is not set" });

  try {
    const payload = jwt.verify(token, secret) as { id?: string; sub?: string };
    const userId = payload.id ?? payload.sub;
    if (!userId) return res.status(401).json({ message: "Invalid access token" });

    (req as any).userId = userId;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid access token" });
  }
}
