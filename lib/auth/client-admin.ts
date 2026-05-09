export function configuredClientAdminEmails() {
  return String(process.env.NEXT_PUBLIC_ADMIN_EMAIL || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isConfiguredAdminUserEmail(email?: string | null) {
  if (!email) return false;
  return configuredClientAdminEmails().includes(email.trim().toLowerCase());
}

export function isClientAdmin(input: {
  email?: string | null;
  role?: string | null;
}) {
  return input.role === 'admin' || isConfiguredAdminUserEmail(input.email);
}
