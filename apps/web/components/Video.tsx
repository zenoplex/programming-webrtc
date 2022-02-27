import { forwardRef } from 'react';
import { createStyles, MantineTheme } from '@mantine/core';

const useStyles = createStyles((theme: MantineTheme) => ({
  grayscale: {
    filter: 'grayscale(100%)',
  },
  sepia: {
    filter: 'sepia(100%)',
  },
  noir: {
    filter: 'grayscale(100%) contrast(300%) brightness(60%)',
  },
  psychedelic: {
    filter: 'hue-rotate(180deg) saturate(400%) contrast(200%)',
  },
}));

interface Props
  extends React.DetailedHTMLProps<
    React.VideoHTMLAttributes<HTMLVideoElement>,
    HTMLVideoElement
  > {
  className?: string;
  filter?: 'grayscale' | 'sepia' | 'noir' | 'psychedelic';
}

const Video = forwardRef<HTMLVideoElement, Props>(
  ({ className, filter, ...props }, ref) => {
    const { classes, cx } = useStyles();

    return (
      <video
        ref={ref}
        className={cx(filter && classes[filter], className)}
        {...props}
      />
    );
  }
);
Video.displayName = 'Video';

export default Video;
