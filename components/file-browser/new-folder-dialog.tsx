'use client';

import { type FormEvent, useState } from 'react';
import { describeFileError } from '../../lib/files-api';
import { CommandButton } from '../ui/command-button';
import { Modal } from '../ui/modal';

export function NewFolderDialog({
  siblingNames,
  onCreate,
  onClose,
}: {
  siblingNames: string[];
  onCreate: (name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmed = name.trim();
  // Checked here for immediate feedback; the backend still owns the answer and
  // can refuse a name this never saw, from a folder created a second ago.
  const isDuplicate = siblingNames.some(
    (sibling) => sibling.toLowerCase() === trimmed.toLowerCase(),
  );
  const canSubmit = trimmed.length > 0 && !isDuplicate && !isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsPending(true);
    setServerError(null);

    try {
      await onCreate(trimmed);
      onClose();
    } catch (error) {
      setServerError(describeFileError(error));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Modal label="nova pasta" onClose={onClose}>
      <form aria-label="nova pasta" onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="new-folder-name" className="text-[12px] text-content-secondary">
          Nome da pasta
        </label>
        <div className="flex items-center gap-2 border border-line bg-base-900 px-2 py-1">
          <span aria-hidden className="text-amber-600">
            &gt;
          </span>
          <input
            id="new-folder-name"
            autoFocus
            value={name}
            maxLength={120}
            autoComplete="off"
            disabled={isPending}
            onChange={(event) => setName(event.target.value)}
            className="focus-ring min-w-0 flex-1 bg-transparent text-[13px] text-content-primary outline-none placeholder:text-content-muted"
            placeholder="ex.: prints"
          />
        </div>

        {isDuplicate ? (
          <p className="text-[11px] text-danger-500">já existe uma pasta com esse nome aqui</p>
        ) : null}
        {serverError ? <p className="text-[11px] text-danger-500">{serverError}</p> : null}
        {isPending ? (
          <p className="text-[11px] text-content-muted">
            criando<span className="animate-caret">_</span>
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <CommandButton type="button" onClick={onClose} disabled={isPending}>
            Cancelar
          </CommandButton>
          <CommandButton type="submit" tone="primary" disabled={!canSubmit}>
            Criar
          </CommandButton>
        </div>
      </form>
    </Modal>
  );
}
