'use client';

import { API_BASE_URL_FALLBACK, isApiBaseUrlConfigured, isMockMode } from '../lib/env';

/**
 * Loud, on-screen warning for the one misconfiguration that otherwise looks
 * like an app bug: a build that ran without NEXT_PUBLIC_API_BASE_URL. The value
 * is inlined at build time, so the login link ends up pointing at the
 * visitor's own machine instead of the server.
 */
export function ConfigWarning() {
  if (isMockMode() || isApiBaseUrlConfigured()) return null;

  return (
    <div role="alert" className="space-y-2 border border-danger-600 bg-base-850 p-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-danger-500 glow">
        configuração ausente
      </p>
      <p className="text-[12px] leading-relaxed text-content-secondary">
        Este build foi gerado sem <span className="text-amber-300">NEXT_PUBLIC_API_BASE_URL</span>,
        então o cliente está apontando para{' '}
        <span className="text-amber-300">{API_BASE_URL_FALLBACK}</span> — que é a máquina de quem
        está acessando, não o servidor. O login com Google não vai funcionar assim.
      </p>
      <pre className="overflow-x-auto border border-line bg-base-900 p-2 text-[11px] text-content-muted">
{`NEXT_PUBLIC_API_BASE_URL=http://SEU-IP:3001 npm run build`}
      </pre>
      <p className="text-[11px] leading-relaxed text-content-muted">
        Variáveis <span className="text-content-secondary">NEXT_PUBLIC_*</span> são congeladas
        durante o build. Defini-las só em runtime (env do compose, export antes do start) não altera
        o bundle que vai para o navegador — é preciso rebuildar.
      </p>
    </div>
  );
}
