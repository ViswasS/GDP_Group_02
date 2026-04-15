const { ApiError } = require("../errors/ApiError");

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return next(new ApiError(400, "Validation error", result.error.flatten()));
    }
    req.validated = result.data;
    next();
  };
}

module.exports = { validate };
