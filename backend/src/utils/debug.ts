/** TEMPORARY debug switch: with DEBUG_ALWAYS_OPEN=true, shops/schools count as open so orders can flow at any time. Remove before release. */
/** Never honoured in production, so a leftover env var cannot let orders flow while shops are closed. */
export const isDebugAlwaysOpen = () =>
  process.env.NODE_ENV !== 'production' &&
  process.env.DEBUG_ALWAYS_OPEN === 'true';
