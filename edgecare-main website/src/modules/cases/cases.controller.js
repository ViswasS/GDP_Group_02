const service = require("./cases.service");

async function create(req, res, next) {
  try {
    const triageCase = await service.createCase({ userId: req.user.id, ...req.validated.body });
    res.status(201).json({ success: true, data: triageCase, message: "Case created" });
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const cases = await service.listCasesForUser({ userId: req.user.id, role: req.user.role });
    res.json({ success: true, data: cases });
  } catch (e) {
    next(e);
  }
}

async function getById(req, res, next) {
  try {
    const triageCase = await service.getCaseById({
      userId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
    });
    // Explicitly surface ML fields to callers
    const mlFields = {
      mlStatus: triageCase.mlStatus ?? null,
      mlFusedResult: triageCase.mlFusedResult ?? null,
      mlSymptomsResult: triageCase.mlSymptomsResult ?? null,
      mlImageResult: triageCase.mlImageResult ?? null,
    };
    res.json({ success: true, data: { ...triageCase, ...mlFields } });
  } catch (e) {
    next(e);
  }
}

async function assignDoctor(req, res, next) {
  try {
    const updated = await service.assignDoctor({
      actorId: req.user.id,
      caseId: req.validated.params.id,
      doctorId: req.validated.body.doctorId,
    });
    res.json({ success: true, data: updated, message: "Doctor review requested" });
  } catch (e) {
    next(e);
  }
}

async function requestDoctor(req, res, next) {
  try {
    const result = await service.requestDoctorAssignment({
      actorId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
    });
    res.status(result.assigned ? 200 : 202).json({
      success: true,
      data: result,
      message: result.assigned ? "Doctor review requested" : "Doctor review not available",
    });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const updated = await service.updateCase({
      userId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
      patch: req.validated.body,
    });
    res.json({ success: true, data: updated, message: "Case updated" });
  } catch (e) {
    next(e);
  }
}

async function reuploadImage(req, res, next) {
  try {
    const result = await service.replaceCaseImage({
      userId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
      imageUrls: req.validated.body.imageUrls,
    });
    res.json({ success: true, data: result, message: "Case image replaced" });
  } catch (e) {
    next(e);
  }
}

async function attachImages(req, res, next) {
  try {
    const updated = await service.addCaseImages({
      userId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
      imageUrls: req.validated.body.imageUrls,
    });
    res.json({ success: true, data: updated, message: "Images saved" });
  } catch (e) {
    next(e);
  }
}

async function saveMl(req, res, next) {
  try {
    const updated = await service.saveMlResults({
      userId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
      mlPayload: req.validated.body,
    });
    res.json({ success: true, data: updated, message: "ML results stored" });
  } catch (e) {
    next(e);
  }
}

async function saveDoctorReview(req, res, next) {
  try {
    const result = await service.saveDoctorReview({
      userId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
      review: req.validated.body,
    });
    res.json({ success: true, data: result, message: "Doctor review saved" });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await service.deleteCase({
      userId: req.user.id,
      role: req.user.role,
      caseId: req.validated.params.id,
    });
    res.json({ success: true, message: "Case deleted" });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create,
  list,
  getById,
  assignDoctor,
  requestDoctor,
  update,
  remove,
  attachImages,
  reuploadImage,
  saveMl,
  saveDoctorReview,
};
