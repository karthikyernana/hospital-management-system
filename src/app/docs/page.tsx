import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = { title: "API docs" };

/** Swagger UI for /api/openapi.json (assets from the swagger-ui-dist CDN). */
export default function ApiDocsPage() {
  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
      <div className="bg-white">
        <div className="border-b border-slate-200 px-6 py-3 text-sm">
          <strong>Hospital Management System API</strong> · <a className="text-teal-700 underline" href="/api/openapi.json">openapi.json</a> · Sign in at <a className="text-teal-700 underline" href="/login">/login</a> first to try authenticated calls (cookie session).
        </div>
        <div id="swagger-ui" />
      </div>
      <Script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" strategy="afterInteractive" />
      <Script id="swagger-init" strategy="lazyOnload">{`
        window.ui = SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui", withCredentials: true, deepLinking: true });
      `}</Script>
    </>
  );
}
