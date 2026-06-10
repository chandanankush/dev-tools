import { ImageResponse } from "next/og";

export const alt = "Dev Toolkit — Free browser-based developer tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f172a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#f8fafc",
            letterSpacing: "-2px",
          }}
        >
          Dev Toolkit
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Free browser-based developer tools — no install required
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#818cf8",
            marginTop: 12,
          }}
        >
          mopplications.com
        </div>
      </div>
    ),
    { ...size }
  );
}
