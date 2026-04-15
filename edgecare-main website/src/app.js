const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const { errorHandler } = require("./common/errors/errorHandler");
const { apiRouter } = require("./routes");
const { env, isAllowedCorsOrigin } = require("./config/env");

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");
  const publicLoginPage = path.join(publicDir, "doctor-login.html");

  // CSP: allow Cloudinary uploads and external ML service while keeping defaults tight
  const APP_ORIGIN = env.APP_BASE_URL || "https://edgecare.onrender.com";
  const ML_SERVICE_ORIGIN = env.ML_BASE_URL || "https://edge-care.onrender.com";
  const CLOUDINARY_UPLOAD_ORIGIN = "https://api.cloudinary.com";
  const CLOUDINARY_ASSETS_ORIGIN = "https://res.cloudinary.com";
  const APP_WS_ORIGIN = APP_ORIGIN.replace(/^http/i, "ws");
  const ML_WS_ORIGIN = ML_SERVICE_ORIGIN.replace(/^http/i, "ws");
  const corsOptions = {
    origin(origin, callback) {
      if (!origin || isAllowedCorsOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    optionsSuccessStatus: 204,
  };

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "connect-src": [
            "'self'",
            APP_ORIGIN,
            APP_WS_ORIGIN,
            CLOUDINARY_UPLOAD_ORIGIN,
            ML_SERVICE_ORIGIN,
            ML_WS_ORIGIN,
          ],
          "img-src": ["'self'", "data:", "blob:", CLOUDINARY_ASSETS_ORIGIN],
          // media allows camera/video blobs (preview uploads)
          "media-src": ["'self'", "blob:"],
        },
      },
    })
  );
  app.use(cors(corsOptions));
  app.use(morgan("dev"));
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));

  /**
 * Admin frontend (root-level folder)
 * URL: /admin/*
 */
  app.use(
    "/admin",
    express.static(path.join(__dirname, "..", "admin"))
  );

  app.get("/", (req, res) => {
    res.sendFile(publicLoginPage);
  });

 /**
 * Public frontend (doctor + shared assets)
 * URL: /*
 */
  app.use(
    express.static(publicDir)
  );

  // API
  app.use("/api/v1", apiRouter);

  // Health
  app.get("/health", (req, res) => res.json({ success: true, status: "ok" }));

  // Errors
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
