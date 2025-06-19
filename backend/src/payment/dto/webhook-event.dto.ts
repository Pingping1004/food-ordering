import { IsString, IsNotEmpty, IsObject, ValidateNested } from "class-validator";

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

    // The 'data' payload depends on the event type.
    // For simplicity, we use IsObject for now, but in a production app,
    // you might want to create a more specific DTO for charge data, transfer data, etc.,
    // and use @Type(() => SpecificEventDataDto) and @ValidateNested()
    @IsObject()
    @IsNotEmpty()
    data: any; // This will hold the actual Omise resource (e.g., ICharge, ITransfer)

    @IsString()
    @IsNotEmpty()
    created_at: string;
}