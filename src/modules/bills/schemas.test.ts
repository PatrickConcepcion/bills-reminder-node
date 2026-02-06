import { billSchema } from "./schemas";

describe("bill schema", () => {
  it("requires frequency for recurring bills", () => {
    const result = billSchema.safeParse({
      name: "Rent",
      amount: 100,
      currency: "USD",
      description: "Monthly rent",
      isRecurring: true,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    expect(result.success).toBe(false);
  });

  it("rejects frequency for non-recurring bills", () => {
    const result = billSchema.safeParse({
      name: "One Time",
      amount: 50,
      currency: "USD",
      description: "One time",
      isRecurring: false,
      frequency: "MONTHLY",
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    expect(result.success).toBe(false);
  });

  it("rejects due dates in the past", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const result = billSchema.safeParse({
      name: "Late",
      amount: 10,
      currency: "USD",
      description: "Past",
      isRecurring: false,
      dueDate: yesterday
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid recurring bill", () => {
    const result = billSchema.safeParse({
      name: "Gym",
      amount: 25,
      currency: "USD",
      description: "Membership",
      isRecurring: true,
      frequency: "MONTHLY",
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    expect(result.success).toBe(true);
  });
});
