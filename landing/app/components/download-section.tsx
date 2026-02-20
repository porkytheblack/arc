"use client";

import { useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { fetchLatestRelease, type ReleaseData } from "../actions/releases";

/* ------------------------------------------------------------------ */
/* Platform icon SVGs                                                  */
/* ------------------------------------------------------------------ */

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();

  if (p.includes("mac") || p.includes("darwin") || p.includes("osx")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 5-4 5-8.5 0-4.14-2.46-6.5-5-6.5-1.33 0-2.42.56-3.47 1.18a.5.5 0 0 1-.53 0C10.92 7.56 9.83 7 8.5 7 6.13 7 3 9.86 3 13.5 3 18 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
        <path d="M12 7c0-2.76-1.12-5-3.5-5" />
      </svg>
    );
  }

  if (p.includes("win")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="8" />
        <rect x="13" y="3" width="8" height="8" />
        <rect x="3" y="13" width="8" height="8" />
        <rect x="13" y="13" width="8" height="8" />
      </svg>
    );
  }

  /* Linux */
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/* Download section                                                    */
/* ------------------------------------------------------------------ */

export function DownloadSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [release, setRelease] = useState<ReleaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchLatestRelease()
      .then((data) => {
        if (data) setRelease(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section
      id="download"
      ref={ref}
      className="py-16 md:py-40 px-4 sm:px-8 scroll-mt-8"
      style={{ borderTop: "1px solid #dce5dc" }}
    >
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <span
            className="font-(family-name:--font-mono) text-sage-300 uppercase tracking-widest block mb-4"
            style={{ fontSize: 11, letterSpacing: "0.15em" }}
          >
            Download
          </span>
          <h2
            className="font-(family-name:--font-display) text-sage-900 text-3xl sm:text-[40px]"
          >
            Get Arc
          </h2>
          <p
            className="font-(family-name:--font-body) text-sage-700 mt-3 mx-auto"
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              fontWeight: 400,
              maxWidth: 400,
            }}
          >
            Desktop app for macOS, Windows, and Linux.
          </p>
        </motion.div>

        {/* Release info */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="mt-12"
        >
          {loading ? (
            <div
              className="font-(family-name:--font-body) text-sage-400"
              style={{ fontSize: 13 }}
            >
              Loading release information...
            </div>
          ) : error || !release ? (
            /* Coming soon fallback */
            <div
              className="border border-sage-100 bg-cream-50 mx-auto"
              style={{ padding: 32, maxWidth: 400 }}
            >
              <span
                className="font-(family-name:--font-body) text-sage-500"
                style={{ fontSize: 15, fontWeight: 500 }}
              >
                Coming soon
              </span>
              <p
                className="font-(family-name:--font-body) text-sage-400 mt-2"
                style={{ fontSize: 13 }}
              >
                Release builds are being prepared. Check back shortly.
              </p>
            </div>
          ) : (
            <>
              {/* Version badge */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <span
                  className="font-(family-name:--font-mono) text-sage-500 bg-sage-50 border border-sage-100"
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                  }}
                >
                  v{release.version}
                </span>
                <span
                  className="font-(family-name:--font-mono) text-sage-400"
                  style={{ fontSize: 11 }}
                >
                  {formatDate(release.pubDate)}
                </span>
              </div>

              {/* Download buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {release.installers.map((installer, i) => (
                  <a
                    key={i}
                    href={installer.downloadUrl}
                    className="inline-flex items-center gap-3 bg-sage-900 text-sage-50 border border-sage-900 hover:bg-sage-700 hover:border-sage-700"
                    style={{
                      padding: "12px 18px",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    <PlatformIcon platform={installer.platform} />
                    <span>{installer.displayName}</span>
                    <span
                      className="font-(family-name:--font-mono) text-sage-300"
                      style={{ fontSize: 11 }}
                    >
                      {formatFileSize(installer.fileSize)}
                    </span>
                  </a>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
