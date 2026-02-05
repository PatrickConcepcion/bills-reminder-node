import { AppDataSource } from "../../data-source";
import { Bill, Frequency } from "../../entities/Bill";
import { CreateBillInput } from "./types";

const repo = AppDataSource.getRepository(Bill);

function calculateNextDueDate(dueDate: Date, frequency: string | null | undefined): Date {
  if (!frequency) return dueDate;

  const nextDate = new Date(dueDate);
  
  switch (frequency) {
    case "WEEKLY":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "MONTHLY":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "YEARLY":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      return dueDate;
  }
  
  return nextDate;
}

export async function getAllBills(userId: string) {
  return repo.find({
    where: { userId },
    order: { nextDueDate: "ASC" }
  });
}

export async function createBill(userId: string, payload: CreateBillInput) {
  const dueDate = new Date(payload.dueDate);
  const nextDueDate = dueDate;

  const bill = repo.create({
    userId,
    name: payload.name.trim(),
    amount: payload.amount.toString(),
    currency: payload.currency,
    description: payload.description?.trim() ?? null,
    isRecurring: payload.isRecurring,
    frequency: payload.frequency as Frequency | null ?? null,
    dueDate,
    nextDueDate,
    lastPaidAt: null,
    isActive: payload.isActive
  });

  return repo.save(bill);
}

export async function getBillById(userId: string, id: string) {
  return repo.findOne({
    where: { userId, id }
  });
}

export async function updateBill(userId: string, id: string, payload: CreateBillInput) {
    // We can use the GetBillById function here but to follow SOLID principle and keep concerns separated,
    // I decided to use findOne instead.
    const bill = await repo.findOne({ where: { userId, id } });
    if (!bill) return null;

    const dueDate = new Date(payload.dueDate);
    const nextDueDate = dueDate;

    bill.name = payload.name.trim();
    bill.amount = payload.amount.toString();
    bill.currency = payload.currency;
    bill.description = payload.description?.trim() ?? null;
    bill.isRecurring = payload.isRecurring;
    bill.frequency = payload.frequency as Frequency | null ?? null;
    bill.dueDate = dueDate;
    bill.nextDueDate = nextDueDate;
    bill.isActive = payload.isActive;

    return repo.save(bill);
}

export async function deleteBill(userId: string, id: string) {
    const bill = await repo.findOne({ where: { userId, id } });
    if (!bill) return null;

    return repo.remove(bill);
}
