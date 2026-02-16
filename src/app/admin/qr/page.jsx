// src/app/admin/qr/page.jsx
"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";

function safeOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin || "";
}

function qrSrc(url, size = 700) {
  const data = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}&margin=10`;
}

export default function AdminQrPage() {
  const [origin] = useState(() => safeOrigin());

  const clientUrl = useMemo(() => {
    if (!origin) return "";
    return `${origin}/client`;
  }, [origin]);

  const onPrint = () => {
    try {
      window.print();
    } catch {
      // ignore
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(clientUrl);
      // no fancy toast; keep it simple
      alert("Copied!");
    } catch {
      // ignore
    }
  };

  return (
    <div className="qrpage">
      <style jsx global>{`
        .qrpage {
          padding: 18px;
          max-width: 900px;
          margin: 0 auto;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .title {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
        }

        .actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: inherit;
          border-radius: 10px;
          padding: 10px 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .hint {
          opacity: 0.75;
          margin: 0 0 12px 0;
          line-height: 1.35;
        }

        /* ===== LAMINATE CARD (what prints) ===== */
        .card {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 16px;
          padding: 16px;
          display: grid;
          justify-items: center;
          gap: 10px;
        }

        .cardText {
          font-size: 18px;
          font-weight: 900;
          text-align: center;
          line-height: 1.2;
        }

        .qrShell {
          background: #fff;
          border-radius: 14px;
          padding: 12px;
          display: grid;
          place-items: center;
        }

        .qrImg {
          width: 360px;
          height: 360px;
        }

        .tinyUrl {
          font-family:
            ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          opacity: 0.75;
          text-align: center;
          overflow-wrap: anywhere;
        }

        /* Print only the laminate card */
        @media print {
          body {
            background: #fff !important;
          }

          .qrpage {
            padding: 0;
            margin: 0;
            max-width: none;
          }

          .toolbar,
          .hint {
            display: none !important;
          }

          .card {
            border: none;
            background: #fff;
            border-radius: 0;
            padding: 0;
          }

          /* Make it nice and big on paper */
          .cardText {
            font-size: 22px;
          }

          .qrImg {
            width: 520px;
            height: 520px;
          }

          .tinyUrl {
            font-size: 10px;
            opacity: 0.6;
          }
        }
      `}</style>

      <div className="toolbar">
        <h1 className="title">Print QR -/client</h1>
        <div className="actions">
          <button className="btn" onClick={onPrint} disabled={!clientUrl}>
            Print
          </button>
          <button className="btn" onClick={onCopy} disabled={!clientUrl}>
            Copy URL
          </button>
        </div>
      </div>

      <p className="hint">
        This can print a simple QR code.
      </p>

      {!clientUrl ? (
        <div className="card">
          Open this page in a browser to generate the QR.
        </div>
      ) : (
        <div className="card">
          <div className="cardText">Scan for live wait times</div>

          <div className="qrShell">
            <img className="qrImg" src={qrSrc(clientUrl, 900)} alt="QR code" />
          </div>

          <div className="tinyUrl">{clientUrl}</div>
        </div>
      )}
    </div>
  );
}
