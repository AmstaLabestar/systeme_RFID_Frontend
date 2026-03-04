import { validateSync } from 'class-validator';
import {
  IsModernPassword,
  MODERN_PASSWORD_MAX_LENGTH,
  MODERN_PASSWORD_MIN_LENGTH,
} from './password-policy.validator';

class PasswordPolicyDto {
  @IsModernPassword()
  password!: string;
}

function validatePassword(password: string): ReturnType<typeof validateSync> {
  const dto = new PasswordPolicyDto();
  dto.password = password;
  return validateSync(dto);
}

describe('IsModernPassword', () => {
  it('accepts long passphrases without character class requirements', () => {
    const errors = validatePassword('this is a long modern passphrase');
    expect(errors).toHaveLength(0);
  });

  it(`rejects passwords shorter than ${MODERN_PASSWORD_MIN_LENGTH}`, () => {
    const errors = validatePassword('short-pass');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints?.IsModernPassword).toBe(
      `Password must contain at least ${MODERN_PASSWORD_MIN_LENGTH} characters.`,
    );
  });

  it('rejects whitespace-only passwords', () => {
    const errors = validatePassword(' '.repeat(MODERN_PASSWORD_MIN_LENGTH));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints?.IsModernPassword).toBe(
      'Password cannot be empty or whitespace only.',
    );
  });

  it(`rejects passwords longer than ${MODERN_PASSWORD_MAX_LENGTH}`, () => {
    const errors = validatePassword('a'.repeat(MODERN_PASSWORD_MAX_LENGTH + 1));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints?.IsModernPassword).toBe(
      `Password must contain at most ${MODERN_PASSWORD_MAX_LENGTH} characters.`,
    );
  });
});
