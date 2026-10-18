/** TEMPORARY debug switch: with DEBUG_ALWAYS_OPEN=true, shops/schools count as open so orders can flow at any time. Remove before release. */
export const isDebugAlwaysOpen = () => process.env.DEBUG_ALWAYS_OPEN === 'true';
