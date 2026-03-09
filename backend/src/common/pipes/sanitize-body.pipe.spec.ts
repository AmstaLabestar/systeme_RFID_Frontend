import { SanitizeBodyPipe } from './sanitize-body.pipe';

describe('SanitizeBodyPipe', () => {
  let pipe: SanitizeBodyPipe;

  beforeEach(() => {
    pipe = new SanitizeBodyPipe();
  });

  it('sanitizes nested body payloads', () => {
    expect(
      pipe.transform(
        {
          name: ' <Alice> ',
          nested: {
            comment: ' Hello<script> ',
          },
        },
        { type: 'body' } as any,
      ),
    ).toEqual({
      name: 'Alice',
      nested: {
        comment: 'Helloscript',
      },
    });
  });

  it('sanitizes query payloads', () => {
    expect(pipe.transform({ search: ' badge<1> ' }, { type: 'query' } as any)).toEqual({
      search: 'badge1',
    });
  });

  it('leaves non-body arguments untouched', () => {
    expect(pipe.transform(' <raw> ', { type: 'param' } as any)).toBe(' <raw> ');
  });
});
