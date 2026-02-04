import { Router } from "express";
import { register, login, logout, refresh, me } from "./controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/me", auth, me);

export default router;
