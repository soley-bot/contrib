import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { signupSchema } from '@/lib/validation';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(' ') });
  }
  const input = parsed.data;

  try {
    // Create auth user without sending a confirmation email
    const { data, error: createError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

    if (createError || !data.user) {
      return res.status(400).json({ error: createError?.message ?? 'Failed to create user.' });
    }

    // Insert profile
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: data.user.id,
      name: input.name,
      university: input.university,
      role: input.role,
    });

    if (profileError) {
      // Roll back the auth user if profile insert fails
      await adminClient.auth.admin.deleteUser(data.user.id);
      return res.status(500).json({ error: 'Failed to create profile. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[signup] error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
