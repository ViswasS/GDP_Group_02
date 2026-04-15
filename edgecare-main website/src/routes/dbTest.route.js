const express = require("express");
const { prisma } = require("../db/prisma");

const router = express.Router();

/**
 * GET /api/v1/db-test
 * Purpose: Verify MySQL (freedb) connectivity
 */
router.get("/db-test", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Database connection successful",
      database: "MySQL (freedb)",
      host: "sql.freedb.tech",
    });
  } catch (err) {
    console.error("DB connection failed:", err);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: err.message,
    });
  }
});

module.exports = { dbTestRouter: router };
