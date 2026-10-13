import { AccountType } from '@prisma/client';

export interface ExtractedReceiverInfo {
    accountNumber: string;
    bankAccount: AccountType;
    paymentType: string;
    promptpayPhone: string | null;
    citizenId: string | null;
    ewalletId: string | null;
    merchantId: string | null;
    merchantName: string | null;
    qrPayload: string;
    warnings: string[];
    needsManualVerification: boolean;
    reason?: string;
}

export function parseTLV(payload: string): Record<string, string> {
    const tags: Record<string, string> = {};
    let i = 0;
    while (i < payload.length) {
        if (i + 4 > payload.length) break;
        const tag = payload.substring(i, i + 2);
        const len = parseInt(payload.substring(i + 2, i + 4), 10);
        if (isNaN(len)) break;
        if (i + 4 + len > payload.length) break;
        const value = payload.substring(i + 4, i + 4 + len);
        tags[tag] = value;
        i += 4 + len;
    }
    return tags;
}

export function extractReceiverInfo(payload: string): ExtractedReceiverInfo {
    const parsed = parseTLV(payload);
    const warnings: string[] = [];
    let needsManualVerification = false;
    let reason = '';

    const info: ExtractedReceiverInfo = {
        accountNumber: '',
        bankAccount: AccountType.PROMPTPAY_PHONE, // fallback
        paymentType: 'Unknown',
        promptpayPhone: null,
        citizenId: null,
        ewalletId: null,
        merchantId: null,
        merchantName: parsed['59'] || null,
        qrPayload: payload,
        warnings,
        needsManualVerification: false
    };

    if (Object.keys(parsed).length === 0) {
        info.needsManualVerification = true;
        info.reason = 'QR payload is malformed or not EMVCo format.';
        info.warnings.push('Malformed QR');
        return info;
    }

    let identifiersCount = 0;

    // Check Tag 29: Credit Transfer (PromptPay)
    if (parsed['29']) {
        const subTags = parseTLV(parsed['29']);
        console.log(subTags);

        if (subTags['01']) {
            let phone = subTags['01'];
            // typically starts with 0066 -> convert to 0
            if (phone.startsWith('0066')) {
                phone = '0' + phone.substring(4);
            }
            info.promptpayPhone = phone;
            info.accountNumber = phone;
            info.bankAccount = AccountType.PROMPTPAY_PHONE;
            info.paymentType = 'PromptPay Phone';
            identifiersCount++;
        }
        if (subTags['02']) {
            info.citizenId = subTags['02'];
            info.accountNumber = subTags['02'];
            info.bankAccount = AccountType.PROMPTPAY_ID;
            info.paymentType = 'PromptPay Citizen ID';
            identifiersCount++;
        }
        if (subTags['03']) {
            info.ewalletId = subTags['03'];
            info.accountNumber = subTags['03'];
            info.bankAccount = AccountType.PROMPTPAY_EWALLET;
            info.paymentType = 'PromptPay E-Wallet';
            identifiersCount++;
        }
    }

    // Check Tag 30: Merchant QR
    if (parsed['30']) {
        const subTags = parseTLV(parsed['30']);
        // Biller ID / Merchant ID is usually 01 or 00 depending on the exact standard
        if (subTags['01']) {
            info.merchantId = subTags['01'];
            info.accountNumber = subTags['01'];
            info.bankAccount = AccountType.MERCHANT_QR;
            info.paymentType = 'Merchant QR';
            identifiersCount++;
        }
    }

    if (identifiersCount === 0) {
        info.needsManualVerification = true;
        info.reason = 'Receiver identifier unavailable (could not find Phone, Citizen ID, E-Wallet, or Merchant ID).';
        info.warnings.push('Receiver identifier unavailable');
    } else if (identifiersCount > 1) {
        info.needsManualVerification = true;
        info.reason = 'Multiple receiver identifiers found in QR code.';
        info.warnings.push('Multiple receiver identifiers');
    }

    if (info.paymentType === 'Merchant QR') {
        info.warnings.push('Merchant QR detected. Preserving Merchant ID.');
        // Merchant QR might need manual verification depending on business logic, but we preserve it.
    }

    return info;
}
