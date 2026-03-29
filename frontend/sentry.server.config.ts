import { init } from "@sentry/nextjs";

init({
    dsn: "https://877246a9c8fec69f4163f29c9d4fd538@o4509643108843520.ingest.us.sentry.io/4509643109040128",
    tracesSampleRate: 0.1,
    debug: false,
});
