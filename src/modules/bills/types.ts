export type CreateBillInput = {
  name: string;
  amount: number;
  currency: string;
  description?: string;
  isRecurring: boolean;
  frequency?: "MONTHLY" | "WEEKLY" | "YEARLY" | null;
  dueDate: string;
<<<<<<< HEAD
  paidAt?: string | null;
=======
  isActive: boolean;
>>>>>>> origin/master
};
