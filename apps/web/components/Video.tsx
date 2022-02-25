import { forwardRef, useState } from 'react';
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
  }
}));

interface Props
  extends React.DetailedHTMLProps<
    React.VideoHTMLAttributes<HTMLVideoElement>,
    HTMLVideoElement
  > {
  className?: string;
}

const filters = ['grayscale', 'sepia', 'noir', 'psychedelic'] as const;

const Video = forwardRef<HTMLVideoElement, Props>(
  ({ className, ...props }, ref) => {
    const { classes, cx } = useStyles();

    const [filterIndex, setFilterIndex] = useState(0);
    const onClick = (e: React.MouseEvent<HTMLVideoElement>) => {
      setFilterIndex(s => (s + 1) % filters.length);
    }

    return (
      <video
        ref={ref}
        className={cx(classes[filters[filterIndex]], className)}
        onClick={onClick}
        {...props}
      />
    );
  }
);
Video.displayName = 'Video';

export default Video;
