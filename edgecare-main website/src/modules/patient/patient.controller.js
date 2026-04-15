const service = require("./patient.service");

async function getProfile(req, res, next) {
  try {
    const profile = await service.getProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    res.json({ success: true, data: profile });
  } catch (e) {
    next(e);
  }
}

async function updateProfile(req, res, next) {
  try {
    const updated = await service.updateProfile(req.user, req.validated.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    res.json({ success: true, data: updated, message: "Profile updated" });
  } catch (e) {
    next(e);
  }
}

module.exports = { getProfile, updateProfile };
