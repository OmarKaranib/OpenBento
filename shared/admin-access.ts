export const ADMIN_EMAILS = [
  'legionofoogabooga@gmail.com',
  'omar.karanib@anculabs.com',
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = email?.trim().toLowerCase() || '';
  return ADMIN_EMAILS.some(adminEmail => adminEmail === normalizedEmail);
}
