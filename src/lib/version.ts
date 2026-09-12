/**
 * Pachas Deployment and Build Version Metadata
 */

export interface VersionInfo {
  commit: string;
  shortCommit: string;
  buildTime: string;
  formattedBuildDate: string;
  githubCommitUrl: string | null;
  environment: string;
}

export function getAppVersionInfo(): VersionInfo {
  const commit =
    process.env.NEXT_PUBLIC_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    'dev';

  const shortCommit =
    commit.length >= 7 ? commit.substring(0, 7) : commit;

  const buildTime =
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    new Date().toISOString();

  let formattedBuildDate = buildTime;
  try {
    const d = new Date(buildTime);
    if (!isNaN(d.getTime())) {
      formattedBuildDate = new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'Europe/Madrid',
      }).format(d);
    }
  } catch {
    formattedBuildDate = buildTime;
  }

  const githubCommitUrl =
    commit && commit !== 'dev'
      ? `https://github.com/emrojo/pachas/commit/${commit}`
      : null;

  return {
    commit,
    shortCommit,
    buildTime,
    formattedBuildDate,
    githubCommitUrl,
    environment: process.env.NODE_ENV || 'development',
  };
}
