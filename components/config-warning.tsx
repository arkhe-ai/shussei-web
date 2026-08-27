'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL_FALLBACK, getApiBaseUrl, isApiBaseUrlConfigured, isMockMode } from '../lib/env';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

type Problem =
  | { kind: 'missing' }
  | { kind: 'localhost-from-remote'; pageHost: string; apiUrl: string }
  | null;

/**
 * Catches the two ways the API base URL goes wrong, both of which look like an
 * app bug instead of a misconfiguration:
 *
 * 1. the build ran without NEXT_PUBLIC_API_BASE_URL at all;
 * 2. it was built with `localhost`, but the page is served from another host —
 *    then `localhost` means the *visitor's* machine and every call, including
 *    the Google login link, goes nowhere.
 *
 * The value is inlined at build time, so neither can be fixed without a rebuild.
 */
export function ConfigWarning() {
  const [problem, setProblem] = useState<Problem>(null);

  useEffect(() => {
    if (isMockMode()) return;

    if (!isApiBaseUrlConfigured()) {
      setProblem({ kind: 'missing' });
      return;
    }

    const apiUrl = getApiBaseUrl();
    const pageHost = window.location.hostname;

    let apiHost: string;
    try {
      apiHost = new URL(apiUrl, window.location.origin).hostname;
    } catch {
      return;
    }

    if (LOCAL_HOSTS.has(apiHost) && !LOCAL_HOSTS.has(pageHost)) {
      setProblem({ kind: 'localhost-from-remote', pageHost, apiUrl });
    }
  }, []);

  if (!problem) return null;

  return (
    <div role="alert" className="space-y-2 border border-danger-600 bg-base-850 p-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-danger-500 glow">
        configuração da api
      </p>

      {problem.kind === 'missing' ? (
        <p className="text-[12px] leading-relaxed text-content-secondary">
          Este build foi gerado sem{' '}
          <span className="text-amber-300">NEXT_PUBLIC_API_BASE_URL</span>, então o cliente está
          apontando para <span className="text-amber-300">{API_BASE_URL_FALLBACK}</span> — que é a
          máquina de quem está acessando, não o servidor.
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-content-secondary">
          Você está acessando por <span className="text-amber-300">{problem.pageHost}</span>, mas
          este build aponta a API para <span className="text-amber-300">{problem.apiUrl}</span>. Para
          quem acessa de outra máquina, <span className="text-amber-300">localhost</span> é o próprio
          computador dela — o login com Google e todas as chamadas vão falhar.
        </p>
      )}

      <pre className="overflow-x-auto border border-line bg-base-900 p-2 text-[11px] text-content-muted">
{`NEXT_PUBLIC_API_BASE_URL=http://${
          problem.kind === 'localhost-from-remote' ? problem.pageHost : 'SEU-IP'
        }:3001 npm run build`}
      </pre>

      <p className="text-[11px] leading-relaxed text-content-muted">
        Variáveis <span className="text-content-secondary">NEXT_PUBLIC_*</span> são congeladas
        durante o build. Editar o <span className="text-content-secondary">.env</span> depois, ou
        definir a env só em runtime, não altera o bundle que já foi para o navegador — tem que
        rebuildar.
      </p>
    </div>
  );
}
