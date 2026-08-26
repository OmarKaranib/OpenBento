import { Resend } from "resend";

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

export function getResendConfig(env: NodeJS.ProcessEnv = process.env): ResendConfig {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return {
    apiKey,
    fromEmail: env.RESEND_FROM_EMAIL?.trim() || "OpenBento <noreply@openbento.tv>",
  };
}

export function getResendClient() {
  const { apiKey, fromEmail } = getResendConfig();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}
