import { cn } from '@/lib/utils';

const sizeStyles = {
  xxs: 'h-2.5 w-2.5',
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
} as const;

const strokeWidths = {
  xxs: 1.5,
  xs: 1.75,
  sm: 2.25,
  md: 2.5,
  lg: 3,
  xl: 3.5,
} as const;

const toneStroke = {
  primary: 'hsl(var(--primary))',
  foreground: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  highlight: 'var(--highlight)',
  black: '#000000',
  white: '#ffffff',
} as const;

/** Single arc + single gap around the circle (~35% stroke / ~65% empty) via exact stroke-dash split. */
const R = 9;
const CIRC = 2 * Math.PI * R;
const ARC_FRAC = 0.35;
const arcDash = ARC_FRAC * CIRC;
const arcGap = CIRC - arcDash;

export type LoadingSpinnerProps = {
  className?: string;
  size?: keyof typeof sizeStyles;
  tone?: keyof typeof toneStroke;
};

export function LoadingSpinner({
  className,
  size = 'md',
  tone = 'primary',
}: LoadingSpinnerProps) {
  const sw = strokeWidths[size];
  const arcColor = toneStroke[tone];

  return (
    <svg
      role="status"
      aria-label="Loading"
      className={cn('shrink-0', sizeStyles[size], className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Full faint track */}
      <circle
        cx="12"
        cy="12"
        r={R}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={0.2}
      />
      {/* Arc: center at (0,0) after translate so CSS rotate uses the real circle center */}
      <g transform={`translate(12 12)`}>
        <g
          className="animate-[spin_0.75s_linear_infinite]"
          style={{ transformOrigin: '0px 0px' }}
        >
          <circle
            cx={0}
            cy={0}
            r={R}
            stroke={arcColor}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${arcDash} ${arcGap}`}
          />
        </g>
      </g>
    </svg>
  );
}
