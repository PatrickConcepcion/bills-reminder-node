import { Request, Response } from "express";
import { ZodError } from "zod";
import { billSchema } from "./schemas";
import { createBill, getAllBills, getBillById, updateBill, deleteBill } from "./service";

export async function getAll(req: Request, res: Response) {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const bills = await getAllBills(userId);

    return res.status(200).json({ bills });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        message: "Validation error",
        errors: error.issues 
      });
    }
    
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const data = billSchema.parse(req.body);
    
    const userId = (req as unknown as { userId: string }).userId;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const bill = await createBill(userId, data);

    return res.status(201).json({ bill });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        message: "Validation error",
        errors: error.issues 
      });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const bill = await getBillById(userId, req.params.id as string);

    return res.status(200).json({ bill });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        message: "Validation error",
        errors: error.issues 
      });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const data = billSchema.parse(req.body);
    
    const userId = (req as unknown as { userId: string }).userId;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const bill = await updateBill(userId, req.params.id as string, data);

    return res.status(200).json({ bill });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        message: "Validation error",
        errors: error.issues 
      });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteById(req: Request, res: Response) {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const bill = await deleteBill(userId, req.params.id as string);

    return res.status(200).json({ bill });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        message: "Validation error",
        errors: error.issues 
      });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}


