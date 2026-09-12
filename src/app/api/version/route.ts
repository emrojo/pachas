import { NextResponse } from 'next/server';
import { getAppVersionInfo } from '@/lib/version';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = getAppVersionInfo();

  return NextResponse.json(
    {
      app: 'Pachas',
      version: '0.1.0',
      commit: version.commit,
      shortCommit: version.shortCommit,
      deployedAt: version.buildTime,
      deployedAtFormatted: version.formattedBuildDate,
      githubCommitUrl: version.githubCommitUrl,
      environment: version.environment,
      uptimeSeconds: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json',
      },
    }
  );
}
