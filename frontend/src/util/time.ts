const now = new Date();
const closeTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);

export const getApproxCloseTime = (): string => {
  const hours = closeTime.getHours().toString().padStart(2, '0');
  const minutes = closeTime.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export const getCurrentTime = (): string => {
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}