import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./modules/auth/routes";
import billRoutes from "./modules/bills/router";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/bills", billRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
