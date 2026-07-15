import { IsEnum } from 'class-validator';
import { IsString, IsNotEmpty, IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  talentId: string;

  @IsString()
  @IsNotEmpty()
  eventTitle: string;

  @IsDateString()
  eventDate: string;

  @IsString()
  @IsNotEmpty()
  venueName: string;

  @IsInt()
  @Min(1)
  venueCapacity: number;

  @IsNumber()
  @Min(0)
  guaranteedBudget: number;

  @IsString()
  @IsNotEmpty()
  usageRights: string;
}

export enum OfferResponseAction {
  CONFIRMED = 'CONFIRMED',
  OFFER_REJECTED = 'OFFER_REJECTED',
}

export class RespondToOfferDto {
  @IsEnum(OfferResponseAction)
  status: OfferResponseAction;
}

export class NegotiateBookingDto {
  @IsNumber()
  @IsNotEmpty()
  guaranteedBudget: number;

  @IsString()
  @IsNotEmpty()
  radiusExclusivity: string;
}
