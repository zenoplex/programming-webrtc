import { useState, useEffect } from 'react';
import {
  AppShell,
  Burger,
  Button,
  Header,
  MediaQuery,
  Navbar,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { DEFAULT_THEME } from '@mantine/core';
import { useNotifications } from '@mantine/notifications';
import { RocketIcon } from '@modulz/radix-icons';
import NavBarLink from '../components/NavBarLink';

const Index = () => {
  const [opened, setOpened] = useState(false);
  const theme = useMantineTheme();

  console.log(process.env.NX_API_ENDPOINT);
  // useEffect(() => {
  //   fetch('/api').then(res => res.json()).then(console.log)
  // }, [])

  const notifications = useNotifications();
  const showNotification = () =>
    notifications.showNotification({
      title: 'Default notification',
      message: 'Hey there, your code is awesome! 🤥',
    });

  useEffect(() => {
    showNotification();
  }, []);

  return (
    <AppShell
      navbarOffsetBreakpoint="sm"
      fixed
      navbar={
        <Navbar
          padding="md"
          hiddenBreakpoint="sm"
          hidden={!opened}
          width={{ sm: 100, lg: 200 }}
        >
          <Navbar.Section>Brand</Navbar.Section>
          <Navbar.Section grow mt="lg">
            <NavBarLink icon={<RocketIcon />} href="/a" color={DEFAULT_THEME.colors.green[5]}>
              aaaa
            </NavBarLink>
          </Navbar.Section>
          <Navbar.Section>user</Navbar.Section>
        </Navbar>
      }
      header={
        <Header height={70} padding="md">
          <div
            style={{ display: 'flex', alignItems: 'center', height: '100%' }}
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
      <Text>Resize app to see responsive navbar in action</Text>
    </AppShell>
  );
};

export default Index;
