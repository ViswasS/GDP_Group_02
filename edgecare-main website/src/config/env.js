const { z } = require("zod");
require("dotenv").config();

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(12),
  JWT_REFRESH_SECRET: z.string().min(12),
  ACCESS_TOKEN_MIN: z.coerce.number().default(30),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),

  BCRYPT_ROUNDS: z.coerce.number().default(12),

  APP_BASE_URL: z.string().url().or(z.literal("")).default(""),
  CORS_ORIGINS: z.string().optional().default(""),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().default(30),

  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().optional(),
  // Optional: base URL for external ML service (used in CSP)
  ML_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  // Groq chat assistant
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional().default("llama-3.1-70b-versatile"),
  GROQ_CHAT_ENABLED: z.coerce.boolean().optional().default(false),
  GROQ_TIMEOUT_MS: z.coerce.number().optional().default(15000),
  GROQ_MAX_TOKENS: z.coerce.number().optional().default(400),
  GROQ_TEMPERATURE: z.coerce.number().optional().default(0.2),
});

const env = schema.parse(process.env);
env.SMTP_FROM = env.SMTP_FROM || env.SMTP_USER;

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "https://edgecare.onrender.com",
  "https://edgecareai.tech",
];

function parseOriginList(value = "") {
  return String(value)
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const corsOrigins = Array.from(
  new Set([...DEFAULT_CORS_ORIGINS, ...parseOriginList(env.CORS_ORIGINS)])
);

function isAllowedCorsOrigin(origin = "") {
  return corsOrigins.includes(String(origin).trim().replace(/\/$/, ""));
}

module.exports = { env, corsOrigins, isAllowedCorsOrigin };
