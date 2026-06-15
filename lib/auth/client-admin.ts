import { isConfiguredAdminEmail } from '@/lib/auth/admin-emails';

export function configuredClientAdminEmails() {
  return String(
    process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
      process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
      process.env.ADMIN_ALERT_EMAIL ||
      process.env.ADMIN_EMAILS ||
      ''
  )
    .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(Boolean);
}

export function isConfiguredAdminUserEmail(email?: string | null) {
  return isConfiguredAdminEmail(email);
}

export function isClientAdmin(input: {
  email?: string | null;
  role?: string | null;
}) {
  return input.role === 'admin' || isConfiguredAdminUserEmail(input.email);
}
