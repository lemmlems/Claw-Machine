import { config } from './config.js';

export type AddressMode = 'wifi' | 'public' | 'local';

export function getAddressState(storedAddress?: string | null) {
  const url = storedAddress ?? (config.publicBaseUrl ? new URL(config.publicBaseUrl).origin : config.wifiBaseUrl);
  const hostname = new URL(url).hostname.toLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  return {
    url,
    isLocal,
    mode: (isLocal ? 'local' : url === config.wifiBaseUrl ? 'wifi' : 'public') as AddressMode,
  };
}
