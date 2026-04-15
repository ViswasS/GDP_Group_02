const express = require("express");
const { validate } = require("../../common/middleware/validate");
const { registerSchema, loginSchema, refreshSchema, logoutSchema } = require("./auth.schemas");
const controller = require("./auth.controller");
const passwordResetController = require("./passwordReset.controller");

const authRouter = express.Router();

authRouter.post("/register", validate(registerSchema), controller.register);
authRouter.post("/login", validate(loginSchema), controller.login);
authRouter.post("/refresh", validate(refreshSchema), controller.refresh);
authRouter.post("/logout", validate(logoutSchema), controller.logout);
authRouter.post("/forgot-password", passwordResetController.forgotPassword);
authRouter.post("/reset-password/verify", passwordResetController.verifyResetToken);
authRouter.post("/reset-password", passwordResetController.resetPassword);

module.exports = { authRouter };
