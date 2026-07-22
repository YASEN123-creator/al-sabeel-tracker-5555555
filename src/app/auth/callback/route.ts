import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type') || '';
  const rawNext = searchParams.get('next') || '/';
  const next = (rawNext.startsWith('/') && !rawNext.startsWith('//')) ? rawNext : '/';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Password recovery: redirect to update-password page
  if (code && (type === 'recovery' || type === 'reset_password')) {
    const redirectUrl = new URL(`${origin}/auth/update-password`);
    redirectUrl.searchParams.set('code', code);
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.session) {
      const redirectUrl = new URL(`${origin}${next}`);
      redirectUrl.hash = `access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}&type=${type || 'signup'}`;
      return NextResponse.redirect(redirectUrl.toString());
    }
    console.error('Auth callback error:', error?.message);
  }

  return NextResponse.redirect(origin);
}
