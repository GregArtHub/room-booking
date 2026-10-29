import { HttpException } from '@nestjs/common';

export interface ErrorDetail {
  field?: string;
  message: string;
}

/** Единый формат бизнес-ошибок: { error: { code, message, details } } */
export class AppException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super({ code, message, details }, status);
  }
}
