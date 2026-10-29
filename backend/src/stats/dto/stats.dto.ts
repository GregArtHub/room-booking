import { Matches } from 'class-validator';

export class DashboardQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from должен быть в формате YYYY-MM-DD' })
  from: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to должен быть в формате YYYY-MM-DD' })
  to: string;
}
