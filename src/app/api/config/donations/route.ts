import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getLiveDonationUrl(): string {
  const username =
    process.env.BUYMEACOFFEE_USERNAME ||
    process.env.NEXT_PUBLIC_BUYMEACOFFEE_USERNAME ||
    'emrojo';
  const customUrl =
    process.env.BUYMEACOFFEE_URL ||
    process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL;

  if (customUrl) {
    return customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
  }

  return `https://www.buymeacoffee.com/${username}`;
}

export async function GET() {
  const url = getLiveDonationUrl();
  return NextResponse.json({ url });
}

