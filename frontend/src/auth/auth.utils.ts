export function getFormattedBackendMessage(message: string | string[] | undefined): string | undefined {
    if (!message) return undefined;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");

    return undefined;
}
