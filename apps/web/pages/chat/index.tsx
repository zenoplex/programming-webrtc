import { useState, useEffect } from 'react';
import {
  Grid,
  Container,
  TextInput,
  Tooltip,
  Group,
  Button,
  Textarea,
  List,
  ThemeIcon,
  Avatar,
} from '@mantine/core';
import { InfoCircledIcon, HomeIcon, ChatBubbleIcon } from '@modulz/radix-icons';

const Page = () => {
  return (
    <Grid grow>
      <Grid.Col span={6}>
        <Group>
          <TextInput
            // label="Room id"
            placeholder="Room id"
            required
            icon={<HomeIcon />}
            rightSection={
              <Tooltip
                label="Enter Room id you wish to connect to"
                position="top"
                placement="end"
              >
                <InfoCircledIcon />
              </Tooltip>
            }
          />
          <Button>Join</Button>
        </Group>
      </Grid.Col>
      <Grid.Col span={6}>
        <div style={{ height: '100%'}}>
        <Grid grow>
          <Grid.Col span={12}>
            <List
              spacing="xs"
              size="sm"
              center
              icon={
                <ThemeIcon color="teal" size={24} radius="xl">
                  <Avatar color="cyan" radius="xl" size={24}>
                    MK
                  </Avatar>
                </ThemeIcon>
              }
            >
              <List.Item>Clone or download repository from GitHub</List.Item>
              <List.Item>Install dependencies with yarn</List.Item>
              <List.Item>
                To start development server run npm start command
              </List.Item>
              <List.Item>
                Run tests to make sure your changes do not break the build
              </List.Item>
              <List.Item>Submit a pull request once you are done</List.Item>
            </List>
          </Grid.Col>
          <Grid.Col>
            <Group>
              <TextInput
                icon={<ChatBubbleIcon />}
                placeholder="Enter message"
              ></TextInput>
              <Button>Send</Button>
            </Group>
          </Grid.Col>
        </Grid>
        </div>
      </Grid.Col>
    </Grid>
  );
};

export default Page;
