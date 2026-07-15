import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

// Only BUYER and TALENT may self-register through the public endpoint.
// AGENT and ADMIN accounts are created internally only.
export enum PublicRole {
  BUYER = 'BUYER',
  TALENT = 'TALENT',
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsEnum(PublicRole)
  @IsOptional()
  role?: PublicRole;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
