const billRepo = {
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn()
};

async function loadService() {
  jest.doMock("../../data-source", () => ({
    AppDataSource: {
      getRepository: () => billRepo
    }
  }));

  return import("./service");
}

describe("bills service", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("creates a bill with normalized fields", async () => {
    const dueDate = new Date("2026-02-15T00:00:00.000Z");
    billRepo.create.mockReturnValue({ id: "bill-1" });
    billRepo.save.mockResolvedValue({ id: "bill-1" });

    const { createBill } = await loadService();
    await createBill("user-1", {
      name: "  Electric  ",
      amount: 120.5,
      currency: "USD",
      description: "  monthly  ",
      isRecurring: true,
      frequency: "MONTHLY",
      dueDate: dueDate.toISOString()
    });

    expect(billRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        name: "Electric",
        amount: "120.5",
        currency: "USD",
        description: "monthly",
        isRecurring: true,
        frequency: "MONTHLY",
        dueDate: expect.any(Date),
        paidAt: null
      })
    );
    expect(billRepo.save).toHaveBeenCalled();
  });

  it("fetches paginated bills ordered by due date", async () => {
    billRepo.findAndCount.mockResolvedValue([[], 0]);
    const { getAllBills } = await loadService();

    await getAllBills("user-1", { page: 1, limit: 12, status: "upcoming" });

    expect(billRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
        order: { dueDate: "ASC" },
        skip: 0,
        take: 12
      })
    );
  });

  it("returns null when updating a missing bill", async () => {
    billRepo.findOne.mockResolvedValue(null);
    const { updateBill } = await loadService();

    const result = await updateBill("user-1", "missing", {
      name: "X",
      amount: 10,
      currency: "USD",
      isRecurring: false,
      dueDate: new Date().toISOString()
    });

    expect(result).toBeNull();
  });

  it("updates a bill and paidAt when provided", async () => {
    const existing = {
      id: "bill-1",
      name: "Old",
      amount: "1.00",
      currency: "USD",
      description: null,
      isRecurring: false,
      frequency: null,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
      paidAt: null as Date | null
    };
    billRepo.findOne.mockResolvedValue(existing);
    billRepo.save.mockResolvedValue(existing);

    const { updateBill } = await loadService();
    await updateBill("user-1", "bill-1", {
      name: " New ",
      amount: 20,
      currency: "EUR",
      description: " note ",
      isRecurring: true,
      frequency: "WEEKLY",
      dueDate: "2026-02-10T00:00:00.000Z",
      paidAt: "2026-02-11T00:00:00.000Z"
    });

    expect(existing.name).toBe("New");
    expect(existing.amount).toBe("20");
    expect(existing.currency).toBe("EUR");
    expect(existing.description).toBe("note");
    expect(existing.isRecurring).toBe(true);
    expect(existing.frequency).toBe("WEEKLY");
    expect(existing.dueDate.toISOString()).toBe("2026-02-10T00:00:00.000Z");
    expect(existing.paidAt?.toISOString()).toBe("2026-02-11T00:00:00.000Z");
    expect(billRepo.save).toHaveBeenCalledWith(existing);
  });

  it("returns null when deleting a missing bill", async () => {
    billRepo.findOne.mockResolvedValue(null);
    const { deleteBill } = await loadService();

    const result = await deleteBill("user-1", "missing");

    expect(result).toBeNull();
  });

  it("returns null when paying a missing bill", async () => {
    billRepo.findOne.mockResolvedValue(null);
    const { payBill } = await loadService();

    const result = await payBill("user-1", "missing");

    expect(result).toBeNull();
  });

  it("rejects paying an already paid bill", async () => {
    billRepo.findOne.mockResolvedValue({
      id: "bill-1",
      isRecurring: false,
      frequency: null,
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
      paidAt: new Date("2026-01-02T00:00:00.000Z")
    });
    const { payBill } = await loadService();

    const result = await payBill("user-1", "bill-1");

    expect(result).toEqual({ error: "already_paid" });
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it("pays a one-time bill without creating a next bill", async () => {
    const bill = {
      id: "bill-1",
      name: "One Time",
      amount: "10.00",
      currency: "USD",
      description: null,
      isRecurring: false,
      frequency: null,
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
      paidAt: null
    };
    billRepo.findOne.mockResolvedValue(bill);
    billRepo.save.mockResolvedValue(bill);

    const { payBill } = await loadService();
    const result = await payBill("user-1", "bill-1");

    expect(result?.bill).toBe(bill);
    expect(result?.nextBill).toBeNull();
    expect(bill.paidAt).toBeInstanceOf(Date);
    expect(billRepo.create).not.toHaveBeenCalled();
  });

  it("pays a recurring bill and creates the next bill", async () => {
    const bill = {
      id: "bill-1",
      name: "Rent",
      amount: "1000.00",
      currency: "USD",
      description: null,
      isRecurring: true,
      frequency: "MONTHLY",
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
      paidAt: null
    };
    const nextBill = { id: "bill-2" };

    billRepo.findOne.mockResolvedValue(bill);
    billRepo.create.mockReturnValue(nextBill);
    billRepo.save
      .mockResolvedValueOnce(bill)
      .mockResolvedValueOnce(nextBill);

    const { payBill } = await loadService();
    const result = await payBill("user-1", "bill-1");

    expect(result?.nextBill).toBe(nextBill);
    expect(billRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        name: "Rent",
        isRecurring: true,
        frequency: "MONTHLY",
        dueDate: expect.any(Date),
        paidAt: null
      })
    );
  });
});
