import crypto from "crypto";
// repositories and module mocking are set per-test via loadService

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn()
}));

const userRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn()
};

const refreshTokenRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn()
};

async function loadService() {
  jest.doMock("../../data-source", () => ({
    AppDataSource: {
      getRepository: (entity: any) => {
        if (entity?.name === "User") return userRepo;
        if (entity?.name === "RefreshToken") return refreshTokenRepo;
        return userRepo;
      }
    }
  }));

  return import("./service");
}

describe("auth service", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.REFRESH_TOKEN_TTL_DAYS = "14";
  });

  it("registers a user", async () => {
    const bcrypt = await import("bcrypt");
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed");
    userRepo.findOne.mockResolvedValue(null);
    userRepo.create.mockReturnValue({
      id: "user-1",
      email: "a@example.com",
      name: "A",
      passwordHash: "hashed"
    });
    userRepo.save.mockResolvedValue(undefined);

    const { registerUser } = await loadService();
    const result = await registerUser({
      email: "a@example.com",
      password: "secret123",
      name: "A"
    });

    expect(result.user.email).toBe("a@example.com");
    expect(userRepo.save).toHaveBeenCalled();
  });

  it("rejects login for invalid email", async () => {
    userRepo.findOne.mockResolvedValue(null);

    const { loginUser } = await loadService();
    await expect(
      loginUser({ email: "a@example.com", password: "secret123" })
    ).rejects.toThrow("Invalid credentials");
  });

  it("rejects login for invalid password", async () => {
    const bcrypt = await import("bcrypt");
    userRepo.findOne.mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      passwordHash: "hashed",
      name: "A"
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const { loginUser } = await loadService();
    await expect(
      loginUser({ email: "a@example.com", password: "wrong" })
    ).rejects.toThrow("Invalid credentials");
  });

  it("issues refresh token on login", async () => {
    const bcrypt = await import("bcrypt");
    const jwt = await import("jsonwebtoken");
    const randomBytesSpy = jest
      .spyOn(crypto, "randomBytes")
      .mockImplementation(() => Buffer.from("refresh-token"));

    userRepo.findOne.mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      passwordHash: "hashed",
      name: "A"
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue("jwt-token");
    refreshTokenRepo.save.mockResolvedValue(undefined);

    const { loginUser } = await loadService();
    const result = await loginUser({
      email: "a@example.com",
      password: "secret123"
    });

    expect(result.token).toBe("jwt-token");
    expect(result.refreshToken).toBe(Buffer.from("refresh-token").toString("hex"));
    expect(refreshTokenRepo.save).toHaveBeenCalled();

    randomBytesSpy.mockRestore();
  });

  it("refreshUser rejects revoked tokens and revokes family", async () => {
    refreshTokenRepo.findOne.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash",
      familyId: "fam-1",
      userId: "user-1",
      isRevoked: true,
      expiresAt: new Date(Date.now() + 10000)
    });

    const { refreshUser } = await loadService();

    await expect(refreshUser("token")).rejects.toThrow("Refresh token reuse detected");
    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { familyId: "fam-1" },
      { isRevoked: true }
    );
  });

  it("refreshUser rejects expired tokens and revokes family", async () => {
    refreshTokenRepo.findOne.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash",
      familyId: "fam-1",
      userId: "user-1",
      isRevoked: false,
      expiresAt: new Date(Date.now() - 10000)
    });

    const { refreshUser } = await loadService();
    await expect(refreshUser("token")).rejects.toThrow("Refresh token expired");
    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { familyId: "fam-1" },
      { isRevoked: true }
    );
  });

  it("refreshUser rotates tokens and keeps family", async () => {
    const jwt = await import("jsonwebtoken");
    const randomBytesSpy = jest
      .spyOn(crypto, "randomBytes")
      .mockImplementation(() => Buffer.from("refresh-token"));

    refreshTokenRepo.findOne.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash",
      familyId: "fam-1",
      userId: "user-1",
      isRevoked: false,
      expiresAt: new Date(Date.now() + 10000)
    });
    userRepo.findOne.mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "A"
    });
    (jwt.sign as jest.Mock).mockReturnValue("jwt-token");
    refreshTokenRepo.save.mockResolvedValue(undefined);

    const { refreshUser } = await loadService();
    const result = await refreshUser("token");

    expect(result.token).toBe("jwt-token");
    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { id: "rt-1" },
      { isRevoked: true }
    );
    expect(refreshTokenRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: "fam-1" })
    );

    randomBytesSpy.mockRestore();
  });
});
