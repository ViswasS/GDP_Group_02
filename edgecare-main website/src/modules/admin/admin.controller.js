const service = require("./admin.service");

async function caseQueue(req, res, next) {
  try {
    const q = req.validated.query || {};
    const data = await service.getAdminCaseQueue({
      status: q.status,
      unassigned: q.unassigned,
      page: q.page,
      pageSize: q.pageSize,
    });

    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function updateProfile(req, res, next) {
  try {
    const updated = await service.updateProfile(req.user.id, req.validated.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    res.json({ success: true, data: updated, message: "Profile updated" });
  } catch (e) {
    next(e);
  }
}

async function insightsOverview(req, res, next) {
  try {
    const data = await service.getInsightsOverview();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function insightsDashboard(req, res, next) {
  try {
    const data = await service.getInsightsDashboard();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function insightsDoctors(req, res, next) {
  try {
    const data = await service.getInsightsDoctors();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function insightsPatients(req, res, next) {
  try {
    const data = await service.getInsightsPatients();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

module.exports = { caseQueue, updateProfile, insightsOverview, insightsDashboard, insightsDoctors, insightsPatients };
