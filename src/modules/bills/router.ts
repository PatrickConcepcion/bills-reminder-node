import { Router } from "express";
import { create, getAll, getById, update, deleteById } from "./controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.get("/", auth, getAll);
router.post("/", auth, create);
router.get("/:id", auth, getById);
router.put("/:id", auth, update);
router.delete("/:id", auth, deleteById);

export default router;
