import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Оборачивает успешные ответы в { data }, списки уже содержат { data, meta }. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null) return body;
        if (typeof body === 'object' && 'data' in (body as object)) return body;
        return { data: body };
      }),
    );
  }
}
