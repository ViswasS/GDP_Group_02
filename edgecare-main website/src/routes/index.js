const express = require("express");
const { authRouter } = require("../modules/auth/auth.routes");
const { usersRouter } = require("../modules/users/users.routes");
const { casesRouter } = require("../modules/cases/cases.routes");
const { triageRouter } = require("../modules/triage/triage.routes");
const { adminRouter } = require("../modules/admin/admin.routes");
const { patientRouter } = require("../modules/patient/patient.routes");
const { doctorRouter } = require("../modules/doctor/doctor.routes");
const { caseChatRouter } = require("../modules/chat/chat.routes");
const { dbTestRouter } = require("./dbTest.route");

const apiRouter = express.Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/cases", casesRouter);
apiRouter.use("/cases/:caseId/chat", caseChatRouter);
apiRouter.use("/triage", triageRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/patient", patientRouter);
apiRouter.use("/doctor", doctorRouter);
apiRouter.use(dbTestRouter); // /api/v1/db-test

module.exports = { apiRouter };
