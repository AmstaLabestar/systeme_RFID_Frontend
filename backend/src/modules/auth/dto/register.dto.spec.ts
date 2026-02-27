import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

function createPayload(overrides: Partial<RegisterDto> = {}): Record<string, unknown> {
  return {
    email: 'alice@example.com',
    password: 'longenoughpass',
    ...overrides,
  };
}

describe('RegisterDto password policy', () => {
  it('accepts passwords with 12+ characters without forcing symbol classes', () => {
    const dto = plainToInstance(RegisterDto, createPayload({ password: 'simplelongpass12' }));
    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects passwords shorter than 12 characters', () => {
    const dto = plainToInstance(RegisterDto, createPayload({ password: 'shortpass' }));
    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints?.IsModernPassword).toBe(
      'Password must contain at least 12 characters.',
    );
  });
});
