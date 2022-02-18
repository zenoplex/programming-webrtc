import { useState } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { MantineProvider } from '@mantine/core';
import { NotificationsProvider } from '@mantine/notifications';
import {
  AppShell,
  Burger,
  Header,
  MediaQuery,
  Navbar,
  Text,
  UnstyledButton,
  Group,
  Avatar,
  useMantineTheme,
} from '@mantine/core';
import { DEFAULT_THEME } from '@mantine/core';
import { RocketIcon } from '@modulz/radix-icons';
import NavBarLink from '../components/NavBarLink';

const App = (props: AppProps) => {
  const { Component, pageProps } = props;
  const [opened, setOpened] = useState(false);
  const theme = useMantineTheme();

  return (
    <>
      <Head>
        <title>Page title</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
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
          <AppShell
            navbarOffsetBreakpoint="sm"
            navbar={
              <Navbar
                padding="md"
                hiddenBreakpoint="sm"
                hidden={!opened}
                width={{ sm: 100, lg: 300 }}
              >
                <Navbar.Section>Brand</Navbar.Section>
                <Navbar.Section grow mt="lg">
                  <NavBarLink
                    icon={<RocketIcon />}
                    href="/chat"
                    color={DEFAULT_THEME.colors.green[5]}
                  >
                    Chat
                  </NavBarLink>
                  <NavBarLink
                    icon={<RocketIcon />}
                    href="/multipeer"
                    color={DEFAULT_THEME.colors.green[5]}
                  >
                    Multipeer
                  </NavBarLink>
                </Navbar.Section>
                <Navbar.Section>
                  <UnstyledButton
                    onClick={() => console.log('try focusing button with tab')}
                  >
                    <Group>
                      <Avatar size={40} color="blue">
                        BH
                      </Avatar>
                      <div>
                        <Text>Bob Handsome</Text>
                        <Text size="xs" color="gray">
                          bob@handsome.inc
                        </Text>
                      </div>
                    </Group>
                  </UnstyledButton>
                </Navbar.Section>
              </Navbar>
            }
            header={
              <Header height={70} padding="md">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <MediaQuery largerThan="sm" styles={{ display: 'none' }}>
                    <Burger
                      opened={opened}
                      onClick={() => setOpened((o) => !o)}
                      size="sm"
                      color={theme.colors.gray[6]}
                      mr="xl"
                    />
                  </MediaQuery>

                  <Text>Application header</Text>
                </div>
              </Header>
            }
          >
            <Component {...pageProps} />
          </AppShell>
        </MantineProvider>
      </NotificationsProvider>
    </>
  );
};

export default App;
