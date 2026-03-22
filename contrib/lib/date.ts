export function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const yearSuffix = date.getFullYear() !== now.getFullYear() ? `, ${date.getFullYear()}` : '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + yearSuffix;
}
