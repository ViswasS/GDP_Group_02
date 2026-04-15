jest.mock("../../../../src/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("../../../../src/config/env", () => ({
  env: {
    JWT_ACCESS_SECRET: "unit-access-secret",
    JWT_REFRESH_SECRET: "unit-refresh-secret",
    ACCESS_TOKEN_MIN: 30,
    REFRESH_TOKEN_DAYS: 7,
    BCRYPT_ROUNDS: 4,
  },
}));

const bcrypt = require("bcrypt");
const { prisma } = require("../../../../src/db/prisma");
const { register, login } = require("../../../../src/modules/auth/auth.service");

describe("auth.service password security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("hashes the password before persistence", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    let createdUserData = null;
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          create: jest.fn().mockImplementation(async ({ data }) => {
            createdUserData = data;
            return {
              id: 42,
              email: "patient@example.com",
              role: "PATIENT",
              createdAt: new Date("2025-04-10T00:00:00.000Z"),
              updatedAt: new Date("2025-04-10T00:00:00.000Z"),
            };
          }),
        },
        patientProfile: {
          create: jest.fn().mockResolvedValue({ patientId: 42 }),
        },
        adminProfile: { create: jest.fn() },
        doctorProfile: { create: jest.fn() },
      })
    );

    await register({
      email: "patient@example.com",
      password: "PlainTextPass123!",
      role: "PATIENT",
      profile: {
        firstName: "Asha",
        lastName: "Patel",
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(createdUserData).toEqual(
      expect.objectContaining({
        email: "patient@example.com",
        role: "PATIENT",
        passwordHash: expect.any(String),
      })
    );
    expect(createdUserData.passwordHash).not.toBe("PlainTextPass123!");
  });

  test("plain text password is not used as the stored value", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    let capturedPasswordHash = null;
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          create: jest.fn().mockImplementation(async ({ data }) => {
            capturedPasswordHash = data.passwordHash;
            return {
              id: 42,
              email: "patient@example.com",
              role: "PATIENT",
              createdAt: new Date("2025-04-10T00:00:00.000Z"),
              updatedAt: new Date("2025-04-10T00:00:00.000Z"),
            };
          }),
        },
        patientProfile: {
          create: jest.fn().mockResolvedValue({ patientId: 42 }),
        },
        adminProfile: { create: jest.fn() },
        doctorProfile: { create: jest.fn() },
      })
    );

    await register({
      email: "patient@example.com",
      password: "PlainTextPass123!",
      role: "PATIENT",
      profile: { firstName: "Asha" },
    });

    expect(capturedPasswordHash).toEqual(expect.any(String));
    expect(capturedPasswordHash).not.toBe("PlainTextPass123!");
    expect(await bcrypt.compare("PlainTextPass123!", capturedPasswordHash)).toBe(true);
  });

  test("accepts the correct password against the stored hash", async () => {
    const storedHash = await bcrypt.hash("CorrectHorseBatteryStaple1!", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 42,
      email: "patient@example.com",
      role: "PATIENT",
      passwordHash: storedHash,
    });
    prisma.refreshToken.create.mockResolvedValue({ id: 10 });

    const result = await login({
      email: "patient@example.com",
      password: "CorrectHorseBatteryStaple1!",
      role: "PATIENT",
      ipAddress: "127.0.0.1",
    });

    expect(result.user).toEqual({
      id: 42,
      email: "patient@example.com",
      role: "PATIENT",
    });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(prisma.refreshToken.create.mock.calls[0][0].data.tokenHash).not.toBe(result.refreshToken);
    expect(await bcrypt.compare(result.refreshToken, prisma.refreshToken.create.mock.calls[0][0].data.tokenHash)).toBe(
      true
    );
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        tokenHash: expect.any(String),
        ipAddress: "127.0.0.1",
      }),
    });
  });

  test("rejects an incorrect password", async () => {
    const storedHash = await bcrypt.hash("CorrectHorseBatteryStaple1!", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 42,
      email: "patient@example.com",
      role: "PATIENT",
      passwordHash: storedHash,
    });

    await expect(
      login({
        email: "patient@example.com",
        password: "WrongPassword!",
        role: "PATIENT",
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials",
    });

    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
