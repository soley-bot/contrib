export function generateInviteToken(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}
