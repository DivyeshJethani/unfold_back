import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'student@cognify.edu' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: 'Password123!', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({ example: 'Aarav Sharma', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '10', required: false })
  @IsOptional()
  @IsString()
  standardId?: string;

  @ApiProperty({ example: 'CBSE', required: false })
  @IsOptional()
  @IsString()
  boardId?: string;

  @ApiProperty({ example: 'SCIENCE', required: false })
  @IsOptional()
  @IsString()
  streamId?: string;
}
