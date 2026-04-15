const service = require("./users.service");

async function me(req, res, next) {
  try {
    const user = await service.getMe(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (e) {
    next(e);
  }
}

// Admin-only (RBAC is enforced in routes)
async function listUsers(req, res, next) {
  try {
    const role = req.query.role ? String(req.query.role).toUpperCase() : undefined;

    // Optional: validate role
    const allowed = ["ADMIN", "DOCTOR", "PATIENT"];
    if (role && !allowed.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed: ${allowed.join(", ")}`,
      });
    }

    const users = await service.listUsers({ role });
    res.json({ success: true, data: users });
  } catch (e) {
    next(e);
  }
}

module.exports = { me, listUsers };
