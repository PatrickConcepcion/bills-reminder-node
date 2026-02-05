import { z } from "zod";

const frequencyEnum = z.enum(["MONTHLY", "WEEKLY", "YEARLY"]);

const amountSchema = z
  .preprocess((val) => {
    if (typeof val === "string") return Number(val);
    return val;
  }, z.number())
  .refine((v) => Number.isFinite(v) && v >= 0, {
    message: "Amount must be a non-negative number"
  });

export const billSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255, "Name must not exceed 255 characters"),
    amount: amountSchema,
    currency: z.string().min(1).max(8).optional().default("USD"),
    description: z.string().max(1000, "Description must not exceed 1000 characters").optional(),
    isRecurring: z.boolean(),
    frequency: frequencyEnum.nullable().optional(),
    dueDate: z.string().datetime({ message: "dueDate must be an ISO datetime string" }),
    isActive: z.boolean().optional().default(true)
  })
  .superRefine((data, ctx) => {
    // Validate recurring bills have frequency
    if (data.isRecurring && !data.frequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frequency"],
        message: "Recurring bills must have a frequency"
      });
    }
    
    if (!data.isRecurring && data.frequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frequency"],
        message: "Non-recurring bills must not have a frequency"
      });
    }
    
    const dueDate = new Date(data.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0); 
    
    if (dueDate < now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "Due date cannot be in the past"
      });
    }
  });
