jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

jest.mock("../../../../src/config/env", () => ({
  env: {
    JWT_ACCESS_SECRET: "test-access-secret",
  },
}));

const jwt = require("jsonwebtoken");
const { requireAuth } = require("../../../../src/common/middleware/auth");

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("requireAuth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 when bearer token is missing", () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing bearer token",
    });
    expect(next).not.toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  test("returns 401 when token verification fails", () => {
    const req = { headers: { authorization: "Bearer bad-token" } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockImplementation(() => {
      throw new Error("invalid token");
    });

    requireAuth(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("bad-token", "test-access-secret");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 401 when token is expired", () => {
    const req = { headers: { authorization: "Bearer expired-token" } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockImplementation(() => {
      const error = new Error("jwt expired");
      error.name = "TokenExpiredError";
      throw error;
    });

    requireAuth(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("expired-token", "test-access-secret");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("attaches authenticated user context and calls next for a valid token", () => {
    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockReturnValue({
      sub: 42,
      role: "PATIENT",
      email: "patient@example.com",
    });

    requireAuth(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-access-secret");
    expect(req.user).toEqual({
      id: 42,
      role: "PATIENT",
      email: "patient@example.com",
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
