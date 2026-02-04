import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);

export default app;
