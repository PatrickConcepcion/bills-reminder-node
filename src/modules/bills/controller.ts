import { Request, Response } from "express";
import { billSchema } from "./schemas";
import { createBill, getAllBills, getBillById, updateBill, deleteBill, payBill } from "./service";
import { AppError } from "../../errors";

function getUserId(req: Request): string {
  const userId = (req as unknown as { userId?: string }).userId;
  if (!userId) throw new AppError(401, "UNAUTHENTICATED", "Unauthenticated");
  return userId;
}

export async function getAll(req: Request, res: Response) {
  const userId = getUserId(req);
  const bills = await getAllBills(userId);

  return res.status(200).json({ bills });
}

export async function create(req: Request, res: Response) {
  const data = billSchema.parse(req.body);
  const userId = getUserId(req);
  const bill = await createBill(userId, data);

  return res.status(201).json({ bill });
}

export async function getById(req: Request, res: Response) {
  const userId = getUserId(req);
  const bill = await getBillById(userId, req.params.id as string);
  if (!bill) throw new AppError(404, "NOT_FOUND", "Bill not found");

  return res.status(200).json({ bill });
}

export async function update(req: Request, res: Response) {
  const data = billSchema.parse(req.body);
  const userId = getUserId(req);
  const bill = await updateBill(userId, req.params.id as string, data);
  if (!bill) throw new AppError(404, "NOT_FOUND", "Bill not found");

  return res.status(200).json({ bill });
}

export async function deleteById(req: Request, res: Response) {
  const userId = getUserId(req);
  const bill = await deleteBill(userId, req.params.id as string);
  if (!bill) throw new AppError(404, "NOT_FOUND", "Bill not found");

  return res.status(200).json({ bill });
}

export async function pay(req: Request, res: Response) {
  const userId = getUserId(req);
  const result = await payBill(userId, req.params.id as string);
  if (!result) throw new AppError(404, "NOT_FOUND", "Bill not found");
  if ("error" in result && result.error === "already_paid") {
    throw new AppError(409, "CONFLICT", "Bill already paid");
  }

  return res.status(200).json(result);
}
