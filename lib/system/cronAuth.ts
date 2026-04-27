export function isCronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  return request.headers.get('authorization') === `Bearer ${expected}`;
}
