export function getParamId(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) {
    return param[0]; // Take the first element if it's an array
  }
  // Ensure it's treated as string | undefined, not ParamValue
  return typeof param === 'string' ? param : undefined;
}