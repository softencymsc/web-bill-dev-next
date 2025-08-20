// pages/_app.js
import { CounterProvider } from '../lib/CounterContext';

import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <CounterProvider>
      <Component {...pageProps} />
    </CounterProvider>
  );
}

export default MyApp;