"use server";

export interface Installer {
  downloadUrl: string;
  platform: string;
  fileSize: number;
  displayName: string;
}

export interface ReleaseData {
  version: string;
  pubDate: string;
  installers: Installer[];
}

export async function fetchLatestRelease(): Promise<ReleaseData | null> {
  try {
    const res = await fetch(
      "https://oasis.dterminal.net/arc/releases/latest",
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.release?.data || json?.data;
    if (data && data.installers && data.installers.length > 0) {
      return {
        version: data.version,
        pubDate: data.pubDate || data.pub_date,
        installers: data.installers,
      };
    }
    return null;
  } catch {
    return null;
  }
}
