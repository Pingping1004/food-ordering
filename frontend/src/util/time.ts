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

export const getTimeFormat = (time: string, bufferMins: number = 0): string => {
    const dateObj = new Date(time);
    const bufferTime = new Date(dateObj.getTime() + bufferMins * 60 * 1000);
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    };

    const formattedTime = bufferTime.toLocaleTimeString('en-US', options);
    return formattedTime;
}

export const getDateFormat = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    };

    const formattedDate = date.toLocaleDateString('en-GB', options);
    return formattedDate;
}