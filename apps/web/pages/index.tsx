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

const Page = () => {
  
  

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
    <div>yyyy</div>
  );
};

export default Page;
