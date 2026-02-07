export type CreateBillInput = {
  name: string;
  amount: number;
  currency: string;
  description?: string;
  isRecurring: boolean;
  frequency?: "MONTHLY" | "WEEKLY" | "YEARLY" | null;
  dueDate: string;
  paidAt?: string | null;
};

export type BillListStatus = "overdue" | "upcoming" | "paid";

export type GetBillsInput = {
  page: number;
  limit: number;
  status: BillListStatus;
};
