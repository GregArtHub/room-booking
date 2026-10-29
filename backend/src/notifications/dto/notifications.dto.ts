import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto, ToBoolean } from '../../common/dto/pagination.dto';

export class NotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unread?: boolean;
}
