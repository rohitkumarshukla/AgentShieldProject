import "dotenv/config";

// Keep environment access centralized so future configuration can be validated
// in one place without spreading process.env usage across the application.
export const env = {
  PORT: Number(process.env.PORT) || 4000,
} as const;
