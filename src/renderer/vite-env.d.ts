/// <reference types="vite/client" />

interface FredAppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
}

interface Window {
  fredApi?: {
    getAppInfo: () => Promise<FredAppInfo>;
    [key: string]: unknown;
  };
}
