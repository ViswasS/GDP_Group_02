const { requireRole } = require("../../../../src/common/middleware/rbac");

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("requireRole middleware", () => {
  test("returns 401 when authenticated user context is missing", () => {
    const req = {};
    const res = createRes();
    const next = jest.fn();

    requireRole("PATIENT")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Not authenticated",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 403 when user role is not authorized", () => {
    const req = { user: { id: 7, role: "DOCTOR" } };
    const res = createRes();
    const next = jest.fn();

    requireRole("PATIENT")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden: requires role [PATIENT]",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next when user role is authorized", () => {
    const req = { user: { id: 42, role: "PATIENT" } };
    const res = createRes();
    const next = jest.fn();

    requireRole("PATIENT")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("allows admin access only when ADMIN is explicitly supported", () => {
    const req = { user: { id: 1, role: "ADMIN" } };
    const res = createRes();
    const next = jest.fn();

    requireRole("DOCTOR", "ADMIN")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("does not grant admin override when ADMIN is not included", () => {
    const req = { user: { id: 1, role: "ADMIN" } };
    const res = createRes();
    const next = jest.fn();

    requireRole("DOCTOR")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden: requires role [DOCTOR]",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
