process.env.TZ = 'UTC';

jest.setTimeout(30_000);

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
