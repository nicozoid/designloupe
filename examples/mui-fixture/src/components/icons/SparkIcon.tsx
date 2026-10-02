import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/** House icon: a small spark. */
export function SparkIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.4L12 16.6 5.7 21l2.3-7.4-6-4.4h7.6z" />
    </SvgIcon>
  );
}
