import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("../sentry.server.config");
    }
  }

/** Reports errors thrown in nested Server Components / route handlers to Sentry. */
export const onRequestError = Sentry.captureRequestError;
