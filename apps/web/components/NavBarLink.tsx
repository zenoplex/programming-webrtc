import React from 'react';
import Link from 'next/link';
import {
  ThemeIcon,
  useMantineTheme,  
} from '@mantine/core';
import { createStyles, MantineTheme } from '@mantine/core';

const useStyles = createStyles((theme: MantineTheme) => ({
  mainLink: {
    ...theme.fn.focusStyles(),
    WebkitTapHighlightColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    color:
      theme.colorScheme === 'dark'
        ? theme.colors.dark[1]
        : theme.colors.gray[7],
    fontWeight: 500,
    fontSize: theme.fontSizes.sm,
    padding: 5,
    marginLeft: -5,
    marginRight: -5,
    borderRadius: theme.radius.sm,
    userSelect: 'none',

    '& + &': {
      marginTop: 5,
    },
  },

  active: {
    color: theme.colorScheme === 'dark' ? theme.white : theme.black,
    backgroundColor:
      theme.colorScheme === 'dark'
        ? theme.colors.dark[6]
        : theme.colors.gray[0],
  },

  body: {
    marginLeft: theme.spacing.sm,
  },
}));

interface NavbarMainLinkProps {
  className?: string;
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  color: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export default function NavbarMainLink({
  href,
  className,
  icon,
  children,
  color,
  onClick,
}: NavbarMainLinkProps) {
  const { classes, cx } = useStyles();
  const theme = useMantineTheme();

  return (
    <Link href={href} passHref>
      <a className={cx(classes.mainLink, className)} onClick={onClick}>
        <ThemeIcon
          size={30}
          style={{ backgroundColor: color, color: theme.white }}
          radius="lg"
        >
          {icon}
        </ThemeIcon>
        <div className={classes.body}>{children}</div>
      </a>
    </Link>
  );
}
