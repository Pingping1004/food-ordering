import { Injectable, BadRequestException } from '@nestjs/common';
import sharp = require('sharp');
import jsQR from 'jsqr';
import { extractReceiverInfo, ExtractedReceiverInfo } from './emvco-parser';

@Injectable()
export class QrReaderService {
    async decodeImage(buffer: Buffer): Promise<string> {
        try {
            const image = sharp(buffer);
            const metadata = await image.metadata();
            
            if (!metadata.width || !metadata.height) {
                throw new Error("Could not determine image dimensions");
            }
            
            const { data, info } = await image
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
                
            const qrCode = jsQR(new Uint8ClampedArray(data), info.width, info.height);
            
            if (!qrCode) {
                throw new Error("No QR code found in image");
            }
            
            return qrCode.data;
        } catch (error) {
            throw new BadRequestException(`Failed to decode QR code: ${(error as Error).message}`);
        }
    }

    async processPaymentQr(buffer: Buffer): Promise<ExtractedReceiverInfo> {
        const payload = await this.decodeImage(buffer);
        console.log("Payload: ", payload);
        const info = extractReceiverInfo(payload);
        
        if (info.needsManualVerification) {
            throw new BadRequestException(`QR Validation Failed: ${info.reason}`);
        }
        
        return info;
    }
}
