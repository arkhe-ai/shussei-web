'use client';

import { type FormEvent, useState } from 'react';
import { describeFileError } from '../../lib/files-api';
import { CommandButton } from '../ui/command-button';
import { Modal } from '../ui/modal';

export type MoveTarget = { id: string | null; label: string };

type Mode = 'rename' | 'move' | 'delete' | null;

const ACTION_CLASS =
  'focus-ring border border-line bg-base-850 px-1 text-[11px] text-content-muted transition-colors hover:border-line-bright hover:text-amber-300';

/**
 * Rename, move, download and delete for one row.
 *
 * The dialogs live here rather than in the browser so a row owns its own
 * confirmation: the browser would otherwise have to track which of dozens of
 * cards a pending delete belongs to.
 */
export function FileActions({
  kind,
  name,
  downloadHref,
  moveTargets,
  onRename,
  onMove,
  onDelete,
}: {
  kind: 'arquivo' | 'pasta';
  name: string;
  /** Already resolved by the caller, so this component never has to know where files live. */
  downloadHref?: string;
  moveTargets: MoveTarget[];
  onRename: (name: string) => Promise<unknown>;
  onMove: (folderId: string | null) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [draftName, setDraftName] = useState(name);
  const [destination, setDestination] = useState<string>('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setMode(null);
    setError(null);
    setDraftName(name);
  }

  async function run(action: () => Promise<unknown>) {
    setIsPending(true);
    setError(null);

    try {
      await action();
      close();
    } catch (failure) {
      setError(describeFileError(failure));
    } finally {
      setIsPending(false);
    }
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) return;
    void run(() => onRename(trimmed));
  }

  return (
    <>
      <span className="flex items-center gap-0.5">
        <button
          type="button"
          className={ACTION_CLASS}
          aria-label={`renomear ${name}`}
          onClick={() => {
            setDraftName(name);
            setMode('rename');
          }}
        >
          ren
        </button>

        {moveTargets.length > 0 ? (
          <button
            type="button"
            className={ACTION_CLASS}
            aria-label={`mover ${name}`}
            onClick={() => {
              setDestination('');
              setMode('move');
            }}
          >
            mov
          </button>
        ) : null}

        {downloadHref ? (
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION_CLASS}
            aria-label={`baixar ${name}`}
          >
            get
          </a>
        ) : null}

        <button
          type="button"
          className={ACTION_CLASS}
          aria-label={`excluir ${name}`}
          onClick={() => setMode('delete')}
        >
          del
        </button>
      </span>

      {mode === 'rename' ? (
        <Modal label={`renomear ${kind}`} onClose={close}>
          <form aria-label="renomear" onSubmit={handleRename} className="flex flex-col gap-2">
            <label htmlFor="rename-input" className="text-[12px] text-content-secondary">
              Novo nome
            </label>
            <div className="flex items-center gap-2 border border-line bg-base-900 px-2 py-1">
              <span aria-hidden className="text-amber-600">
                &gt;
              </span>
              <input
                id="rename-input"
                autoFocus
                value={draftName}
                maxLength={120}
                autoComplete="off"
                disabled={isPending}
                onChange={(event) => setDraftName(event.target.value)}
                className="focus-ring min-w-0 flex-1 bg-transparent text-[13px] text-content-primary outline-none"
              />
            </div>

            {error ? <p className="text-[11px] text-danger-500">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-1">
              <CommandButton type="button" onClick={close} disabled={isPending}>
                Cancelar
              </CommandButton>
              <CommandButton
                type="submit"
                tone="primary"
                disabled={isPending || !draftName.trim() || draftName.trim() === name}
              >
                Renomear
              </CommandButton>
            </div>
          </form>
        </Modal>
      ) : null}

      {mode === 'move' ? (
        <Modal label={`mover ${kind}`} onClose={close}>
          <div className="flex flex-col gap-2">
            <label htmlFor="move-target" className="text-[12px] text-content-secondary">
              Destino de <span className="text-amber-300">{name}</span>
            </label>
            <select
              id="move-target"
              value={destination}
              disabled={isPending}
              onChange={(event) => setDestination(event.target.value)}
              className="focus-ring border border-line bg-base-900 px-2 py-1 text-[13px] text-content-primary"
            >
              <option value="">selecione…</option>
              {moveTargets.map((target) => (
                <option key={target.id ?? 'root'} value={target.id ?? 'root'}>
                  {target.label}
                </option>
              ))}
            </select>

            {error ? <p className="text-[11px] text-danger-500">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-1">
              <CommandButton type="button" onClick={close} disabled={isPending}>
                Cancelar
              </CommandButton>
              <CommandButton
                type="button"
                tone="primary"
                disabled={isPending || destination === ''}
                onClick={() => void run(() => onMove(destination === 'root' ? null : destination))}
              >
                Mover
              </CommandButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {mode === 'delete' ? (
        <Modal label={`excluir ${kind}`} onClose={close}>
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-content-primary">
              Excluir <span className="text-amber-300">{name}</span>?
            </p>
            <p className="text-[11px] text-content-muted">
              {kind === 'pasta'
                ? 'A pasta e tudo dentro dela vão junto. Não dá para desfazer.'
                : 'O arquivo some para todo mundo, inclusive das mensagens que o citam.'}
            </p>

            {error ? <p className="text-[11px] text-danger-500">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-1">
              <CommandButton type="button" onClick={close} disabled={isPending}>
                Cancelar
              </CommandButton>
              <CommandButton
                type="button"
                tone="danger"
                disabled={isPending}
                onClick={() => void run(onDelete)}
              >
                Excluir
              </CommandButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
