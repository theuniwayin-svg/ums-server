import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    cursor?: string;
    hasMore?: boolean;
    nextCursor?: string;
  };
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Already wrapped — return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Paginated envelope pattern: { data: [...], meta: {...} }
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data &&
          !Array.isArray(data)
        ) {
          return {
            success: true,
            data: data.data,
            meta: data.meta,
          };
        }

        // Everything else: wrap directly
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
