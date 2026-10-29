import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { env } from '../config/env';
import { userInclude } from '../users/user.mapper';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtAccessSecret,
    });
  }

  /** Роли и блокировка читаются из БД при каждом запросе, а не только из токена. */
  async validate(payload: { sub: number }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: userInclude,
    });
    if (!user || user.isBlocked) throw new UnauthorizedException();
    return { id: user.id, email: user.email, roles: user.roles.map((r) => r.role.name) };
  }
}
