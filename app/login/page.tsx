'use client';

import { motion } from 'motion/react';
import { BrowserSupportNote } from '../../components/browser-support-note';
import { ConfigWarning } from '../../components/config-warning';
import { CommandLink } from '../../components/ui/command-button';
import { KeyHint } from '../../components/ui/key-hint';
import { Panel } from '../../components/ui/panel';
import { Wordmark } from '../../components/ui/wordmark';
import { buildGoogleLoginUrl } from '../../lib/auth';

const BOOT_LINES = [
  'shussei init --org arkhe',
  'canal seguro estabelecido',
  'nenhuma sessão ativa neste dispositivo',
];

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-[580px] space-y-5">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="space-y-2"
        >
          <Wordmark className="text-[13px] sm:text-[15px]" />
          <p className="text-[12px] uppercase tracking-[0.3em] text-content-muted">
            comunicação interna · acesso restrito
          </p>
        </motion.div>

        <ConfigWarning />

        <Panel label="autenticação" right="v0.1.0">
          <div className="space-y-4">
            <ul className="space-y-1 text-[12px] text-content-secondary">
              {BOOT_LINES.map((line, index) => (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.12 * index, ease: 'easeOut' }}
                >
                  <span className="text-amber-700">$</span> {line}
                  {index === BOOT_LINES.length - 1 ? (
                    <span className="ml-1 animate-caret text-amber-500">_</span>
                  ) : null}
                </motion.li>
              ))}
            </ul>

            <div className="border-t border-line pt-4">
              <CommandLink hotkey="G" tone="primary" href={buildGoogleLoginUrl()}>
                Entrar com Google
              </CommandLink>
            </div>

            <p className="text-[12px] leading-relaxed text-content-secondary">
              Qualquer conta Google pode autenticar, mas só e-mails presentes na lista de acesso
              conseguem entrar. Se o seu não estiver, peça liberação para um administrador.
            </p>

            <BrowserSupportNote />
          </div>
        </Panel>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3">
          <KeyHint keys="G">autenticar</KeyHint>
          <KeyHint keys="ESC">cancelar</KeyHint>
          <span className="ml-auto text-[11px] text-content-muted">shussei · arkhe-ai</span>
        </div>
      </div>
    </main>
  );
}
