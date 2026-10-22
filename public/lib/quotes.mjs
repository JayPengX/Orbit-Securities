// Orbit Securities' prices: the shared kit's (stock-quotes.mjs, one copy for
// the phone and the proxy that fills its orders), read through the kit's
// proxyJson (batched, remembered in memory and on the device).
import { proxyJson } from '#kit/orbit.mjs';
import { useQuotesReader } from '#kit/stock-quotes.mjs';

useQuotesReader((url, o) => proxyJson(url, o));
export * from '#kit/stock-quotes.mjs';
