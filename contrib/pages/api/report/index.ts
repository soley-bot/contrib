// PDF generation is client-side (lib/pdf.ts). This route is a placeholder.
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ message: 'PDF export is handled client-side.' });
}
