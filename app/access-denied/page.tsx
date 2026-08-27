'use client';

import { CommandLink } from '../../components/ui/command-button';
import { Panel } from '../../components/ui/panel';
import { buildGoogleLoginUrl } from '../../lib/auth';

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-[520px] space-y-4">
        <Panel label="erro" right="exit 403" className="border-danger-600/60">
          <div className="space-y-4">
            <h1 className="text-[15px] uppercase tracking-[0.24em] text-danger-500 glow">
              Acesso não liberado
            </h1>
            <p className="text-[13px] leading-relaxed text-content-secondary">
              Seu e-mail não está na lista de acesso do Shussei. A autenticação com o Google
              funcionou, mas a autorização foi negada pelo servidor.
            </p>
            <pre className="overflow-x-auto border border-line bg-base-900 p-3 text-[12px] text-content-muted">
{`> auth.google      ok
> allowlist.check  denied
> session          none`}
            </pre>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <CommandLink hotkey="R" href={buildGoogleLoginUrl()}>
                Tentar com outra conta
              </CommandLink>
              <CommandLink hotkey="V" href="/login">
                Voltar
              </CommandLink>
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
