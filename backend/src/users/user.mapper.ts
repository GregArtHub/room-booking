import { Prisma } from '@prisma/client';

export const userInclude = { roles: { include: { role: true } } } satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export function toUserDto(user: UserWithRoles) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    roles: user.roles.map((r) => r.role.name),
    isBlocked: user.isBlocked,
    locale: user.locale,
    theme: user.theme,
    createdAt: user.createdAt,
  };
}
