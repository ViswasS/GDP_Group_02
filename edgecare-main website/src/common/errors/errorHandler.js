const { ApiError } = require("./ApiError");

function errorHandler(err, req, res, next) {
  const status = err instanceof ApiError ? err.statusCode : 500;

  const payload = {
    success: false,
    message: err.message || "Internal Server Error",
  };

  if (err.details) payload.details = err.details;

  // In development, expose stack for debugging
  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { errorHandler };
