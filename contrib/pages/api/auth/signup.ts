import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, name, university, role } = req.body;
  if (!email || !password || !name || !university) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
  }
  if (typeof university !== 'string' || university.trim().length === 0 || university.trim().length > 200) {
    return res.status(400).json({ error: 'University name must be between 1 and 200 characters.' });
  }
  const safeRole = role === 'teacher' ? 'teacher' : 'student';

  // Create auth user without sending a confirmation email
  const { data, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // mark as confirmed so no email is sent
  });

  if (createError || !data.user) {
    return res.status(400).json({ error: createError?.message ?? 'Failed to create user.' });
  }

  // Insert profile
  const { error: profileError } = await adminClient.from('profiles').insert({
    id: data.user.id,
    name: name.trim(),
    university: university.trim(),
    role: safeRole,
  });

  if (profileError) {
    // Roll back the auth user if profile insert fails
    await adminClient.auth.admin.deleteUser(data.user.id);
    return res.status(500).json({ error: profileError.message });
  }

  return res.status(200).json({ ok: true });
}
