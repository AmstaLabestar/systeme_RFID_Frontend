import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export const MODERN_PASSWORD_MIN_LENGTH = 12;
export const MODERN_PASSWORD_MAX_LENGTH = 120;

export type PasswordPolicyViolation = 'invalid_type' | 'too_short' | 'too_long' | 'blank';

export function getPasswordPolicyViolation(value: unknown): PasswordPolicyViolation | null {
  if (typeof value !== 'string') {
    return 'invalid_type';
  }

  if (value.length < MODERN_PASSWORD_MIN_LENGTH) {
    return 'too_short';
  }

  if (value.length > MODERN_PASSWORD_MAX_LENGTH) {
    return 'too_long';
  }

  if (!/\S/.test(value)) {
    return 'blank';
  }

  return null;
}

export function getPasswordPolicyMessage(violation: PasswordPolicyViolation | null): string {
  switch (violation) {
    case 'invalid_type':
      return 'Password must be a string.';
    case 'too_short':
      return `Password must contain at least ${MODERN_PASSWORD_MIN_LENGTH} characters.`;
    case 'too_long':
      return `Password must contain at most ${MODERN_PASSWORD_MAX_LENGTH} characters.`;
    case 'blank':
      return 'Password cannot be empty or whitespace only.';
    default:
      return 'Password does not satisfy the security policy.';
  }
}

export function IsModernPassword(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'IsModernPassword',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return getPasswordPolicyViolation(value) === null;
        },
        defaultMessage(args?: ValidationArguments): string {
          return getPasswordPolicyMessage(getPasswordPolicyViolation(args?.value));
        },
      },
    });
  };
}
