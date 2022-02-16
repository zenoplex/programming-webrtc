import { AppProps } from 'next/app';
import Head from 'next/head';
import { MantineProvider } from '@mantine/core';
import { NotificationsProvider } from '@mantine/notifications';
// import { useEffect } from 'react';

const App = (props: AppProps) => {
  const { Component, pageProps } = props;

  // useEffect(() => {
  //   fetch('/api').then(res => res.json()).then(console.log);
  // }, []);

  return (
    <>
      <Head>
        <title>Page title</title>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>

      <NotificationsProvider>
        <MantineProvider
          withGlobalStyles
          withNormalizeCSS
          theme={{
            /** Put your mantine theme override here */
            colorScheme: 'light',
          }}
        >
          <Component {...pageProps} />
        </MantineProvider>
      </NotificationsProvider>
    </>
  );
}

export default App;
