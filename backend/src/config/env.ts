function secret(name: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'test') return 'test-secret';
  throw new Error(`Переменная окружения ${name} не задана`);
}

// Геттеры, чтобы значения читались в момент обращения (важно для тестов)
export const env = {
  get port(): number {
    return Number(process.env.PORT ?? 3000);
  },
  get jwtAccessSecret(): string {
    return secret('JWT_ACCESS_SECRET');
  },
  get accessTtl(): string {
    return process.env.ACCESS_TTL ?? '15m';
  },
  get refreshTtlDays(): number {
    return Number(process.env.REFRESH_TTL_DAYS ?? 7);
  },
  get frontendUrl(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:5173';
  },
  get uploadDir(): string {
    return process.env.UPLOAD_DIR ?? './uploads';
  },
};
