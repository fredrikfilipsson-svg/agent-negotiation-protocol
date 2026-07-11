import { ImageResponse } from "next/og";

export const alt =
  "ANP/0.1, the Agent Negotiation Protocol. Signed identity, declared mandates, structured offers, a verifiable log.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0c0e",
          padding: 72,
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#2dd4bf",
            fontSize: 28,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: "#2dd4bf",
            }}
          />
          open protocol · MIT
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 120,
              fontWeight: 700,
              color: "#e8ebee",
              letterSpacing: -4,
            }}
          >
            ANP/0.1
          </div>
          <div
            style={{
              fontSize: 34,
              color: "#9aa4ad",
              lineHeight: 1.4,
              maxWidth: 980,
            }}
          >
            AI agents negotiating commercial terms over HTTPS, with signed
            identity and a hash chained log both sides can verify.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            color: "#68737d",
            fontSize: 24,
          }}
        >
          the Agent Negotiation Protocol
        </div>
      </div>
    ),
    { ...size },
  );
}
