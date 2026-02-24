import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeUnknown } from '../utils/security.util';

@Injectable()
export class SanitizeBodyPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (!metadata.type || metadata.type === 'body' || metadata.type === 'query') {
      return sanitizeUnknown(value);
    }
    return value;
  }
}
