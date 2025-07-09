import { IsString, IsNotEmpty, IsObject } from "class-validator";

export class WebhookEventDto {
    @IsString()
    @IsNotEmpty()
    object: string; // SHould be event

    @IsString()
    @IsNotEmpty()
    id: string; // Event ID

    @IsString()
    @IsNotEmpty()
    location: string;

    @IsString()
    @IsNotEmpty()
    type: string;

    @IsObject()
    @IsNotEmpty()
    data: any; // This will hold the actual resource (e.g., ICharge, ITransfer)

    @IsString()
    @IsNotEmpty()
    created_at: string;
}