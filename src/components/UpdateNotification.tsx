import { useState, useEffect, useCallback } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { SAGE, CREAM, FONTS, SPACING } from "../lib/theme";
import { Button } from "./Button";

type UpdateState =
  | { phase: "available"; version: string; update: Update }
  | { phase: "downloading"; progress: number }
  | { phase: "ready" };

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const delay = setTimeout(async () => {
      try {
        const update = await check();
        if (!cancelled && update) {
          setState({ phase: "available", version: update.version, update });
        }
      } catch (e) {
        console.error("Update check failed:", e);
      }
    }, 3000); // Check 3s after mount to not block startup
    return () => {
      cancelled = true;
      clearTimeout(delay);
    };
  }, []);

  const handleUpdate = useCallback(async () => {
    if (state?.phase !== "available") return;
    const { update } = state;

    setState({ phase: "downloading", progress: 0 });

    let contentLength = 0;
    let downloaded = 0;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          contentLength = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            setState({
              phase: "downloading",
              progress: Math.round((downloaded / contentLength) * 100),
            });
          }
        } else if (event.event === "Finished") {
          setState({ phase: "ready" });
        }
      });
      setState({ phase: "ready" });
    } catch (e) {
      console.error("Update download failed:", e);
      // Reset so user can retry
      try {
        const freshUpdate = await check();
        if (freshUpdate) {
          setState({ phase: "available", version: freshUpdate.version, update: freshUpdate });
        } else {
          setState(null);
        }
      } catch {
        setState(null);
      }
    }
  }, [state]);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  if (!state || dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: SPACING.lg,
        right: SPACING.lg,
        zIndex: 999,
        background: CREAM[50],
        border: `1px solid ${SAGE[200]}`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)`,
        padding: SPACING.lg,
        maxWidth: 320,
        animation: "slideUp 0.3s ease",
        display: "flex",
        flexDirection: "column",
        gap: SPACING.md,
      }}
    >
      {state.phase === "available" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  fontWeight: 600,
                  color: SAGE[900],
                }}
              >
                Update Available
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: SAGE[500],
                  marginTop: 2,
                }}
              >
                v{state.version}
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: SAGE[400],
                fontSize: 16,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>
          <Button size="sm" onClick={handleUpdate}>
            Download & Restart
          </Button>
        </>
      )}

      {state.phase === "downloading" && (
        <>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[900],
            }}
          >
            Downloading update…
          </div>
          <div
            style={{
              height: 4,
              background: SAGE[100],
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${state.progress}%`,
                background: SAGE[600],
                borderRadius: 2,
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              color: SAGE[400],
              textAlign: "right",
            }}
          >
            {state.progress}%
          </div>
        </>
      )}

      {state.phase === "ready" && (
        <>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SAGE[900],
            }}
          >
            Update ready
          </div>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: SAGE[500],
            }}
          >
            Restart to apply the update.
          </div>
          <Button size="sm" onClick={handleRelaunch}>
            Restart Now
          </Button>
        </>
      )}
    </div>
  );
}
