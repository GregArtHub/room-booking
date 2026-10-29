import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../app-exception';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Проверка ролей на сервере: пользователь должен иметь хотя бы одну из требуемых ролей. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = context.switchToHttp().getRequest().user as { roles?: string[] } | undefined;
    const allowed = !!user?.roles?.some((r) => required.includes(r));
    if (!allowed) throw new AppException(403, 'FORBIDDEN', 'Недостаточно прав для этого действия');
    return true;
  }
}
