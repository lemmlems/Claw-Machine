import { type FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { HostPayload } from '../types';

export function PublicAddressSettings({
  publicAddress,
  refreshHost,
  onError,
}: {
  publicAddress: HostPayload['publicAddress'];
  refreshHost: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [addressDraft, setAddressDraft] = useState(publicAddress.url);

  useEffect(() => setAddressDraft(publicAddress.url), [publicAddress.url]);

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest('/api/settings/public-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addressDraft }),
      });
      onError(null);
      await refreshHost();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The public address could not be saved.');
    }
  };

  const useWifiAddress = async () => {
    try {
      await apiRequest('/api/settings/use-wifi-address', { method: 'POST' });
      onError(null);
      await refreshHost();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The Wi-Fi address could not be restored.');
    }
  };

  return (
    <section className="address-settings">
      <h3>Public address</h3>
      <p className={`address-mode ${publicAddress.mode}`}>
        {publicAddress.mode === 'wifi'
          ? 'Wi-Fi mode: guests must be on the same Wi-Fi'
          : publicAddress.mode === 'public'
            ? 'Public tunnel mode: guests can join from anywhere'
            : 'Local address warning: this address only works on this PC'}
      </p>
      {publicAddress.isLocal && (
        <p className="local-warning">
          QR printing and downloading are disabled until you set a LAN or public address.
        </p>
      )}
      <form onSubmit={saveAddress} className="address-form">
        <label htmlFor="public-address">Invitation address</label>
        <input
          id="public-address"
          type="url"
          value={addressDraft}
          onChange={(event) => setAddressDraft(event.target.value)}
          placeholder="https://xxxx.trycloudflare.com"
          required
        />
        <div className="address-actions">
          <button type="submit" className="primary-button">Save address</button>
          <button type="button" className="secondary-button" onClick={useWifiAddress}>
            Use my Wi-Fi address
          </button>
        </div>
      </form>
    </section>
  );
}
