'use client';

import { type AudioDevice, DEFAULT_DEVICE_ID, supportsOutputSelection } from '../lib/audio-devices';

/**
 * Input and output selection.
 *
 * Output is hidden rather than disabled where `setSinkId` is missing (Firefox,
 * Safari): a control that silently does nothing is worse than no control, and
 * those browsers already route everything to the OS default.
 */
export function DevicePicker({
  inputs,
  outputs,
  inputDeviceId,
  outputDeviceId,
  onSelectInput,
  onSelectOutput,
}: {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  inputDeviceId: string;
  outputDeviceId: string;
  onSelectInput: (deviceId: string) => void;
  onSelectOutput: (deviceId: string) => void;
}) {
  const canPickOutput = supportsOutputSelection();

  return (
    <div className="space-y-1.5 border border-line bg-base-900 p-2">
      <DeviceSelect
        label="entrada"
        devices={inputs}
        value={inputDeviceId}
        onChange={onSelectInput}
        emptyHint="entre na voz para listar os microfones"
      />

      {canPickOutput ? (
        <DeviceSelect
          label="saida"
          devices={outputs}
          value={outputDeviceId}
          onChange={onSelectOutput}
          emptyHint="nenhuma saida detectada"
        />
      ) : (
        <p className="text-[11px] text-content-muted">
          <span className="text-amber-700">$</span> este navegador não permite escolher a saída de
          áudio — use o padrão do sistema
        </p>
      )}
    </div>
  );
}

function DeviceSelect({
  label,
  devices,
  value,
  onChange,
  emptyHint,
}: {
  label: string;
  devices: AudioDevice[];
  value: string;
  onChange: (deviceId: string) => void;
  emptyHint: string;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-[52px] shrink-0 uppercase tracking-[0.18em] text-content-muted">
        {label}
      </span>
      <select
        className="focus-ring min-w-0 flex-1 border border-line bg-base-950 px-1.5 py-0.5 text-[12px] text-content-secondary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={DEFAULT_DEVICE_ID}>padrão do sistema</option>
        {devices
          .filter((device) => device.deviceId && device.deviceId !== DEFAULT_DEVICE_ID)
          .map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
      </select>
      {devices.length === 0 ? (
        <span className="shrink-0 text-[10px] text-content-muted">{emptyHint}</span>
      ) : null}
    </label>
  );
}
