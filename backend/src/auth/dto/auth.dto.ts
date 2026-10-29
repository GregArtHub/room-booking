import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class RegisterDto {
  @normalizeEmail()
  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(255)
  email: string;

  @IsString({ message: 'Пароль обязателен' })
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(72, { message: 'Пароль должен быть не длиннее 72 символов' })
  password: string;

  @IsString({ message: 'Имя обязательно' })
  @MinLength(2, { message: 'Имя должно быть не короче 2 символов' })
  @MaxLength(100, { message: 'Имя должно быть не длиннее 100 символов' })
  fullName: string;
}

export class LoginDto {
  @normalizeEmail()
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsString({ message: 'Пароль обязателен' })
  password: string;
}

export class RefreshDto {
  @IsString({ message: 'refreshToken обязателен' })
  refreshToken: string;
}

export class ForgotPasswordDto {
  @normalizeEmail()
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'Токен обязателен' })
  token: string;

  @IsString({ message: 'Пароль обязателен' })
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(72, { message: 'Пароль должен быть не длиннее 72 символов' })
  newPassword: string;
}
