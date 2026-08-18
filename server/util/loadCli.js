import * as libreProvider from './providers/loadLibre.js';
import * as ooklaProvider from './providers/loadOokla.js';
import * as cloudflareProvider from './providers/loadCloudflare.js';

export const load = async () => {
    await libreProvider.load();
    await ooklaProvider.load();
    await cloudflareProvider.load();
};