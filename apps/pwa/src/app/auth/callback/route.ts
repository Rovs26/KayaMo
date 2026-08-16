import { createCookieSupabase } from '@kayamo/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const OTP_TYPES = [
  'magiclink',
  'email',
  'signup',
  'invite',
  'recovery',
  'email_change',
] as const;

type OtpType = (typeof OTP_TYPES)[number];

function isOtpType(value: string): value is OtpType {
  return (OTP_TYPES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  const nextPath = url.searchParams.get('next') ?? '/app';
  const next = nextPath.startsWith('/') ? nextPath : '/app';
  const destination = new URL(next, url.origin);

  const cookieStore = await cookies();
  const response = NextResponse.redirect(destination);
  const supabase = createCookieSupabase({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) {
        cookieStore.set(name, value, options);
        response.cookies.set(name, value, options);
      }
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  if (tokenHash && otpType && isOtpType(otpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) return response;
  }

  return NextResponse.redirect(new URL('/login?error=Could%20not%20complete%20sign-in', url.origin));
}
