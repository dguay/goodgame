import Svg, { Circle, Path } from 'react-native-svg'

interface Props {
  size: number
  color: string
  focused: boolean
}

export function GoodgameLibraryIcon({ size, color, focused }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.9 6.5c1.1-1 2.9-1.4 4.7-.7.9.4 1.9.4 2.8 0 1.8-.7 3.6-.3 4.7.7 1.6 1.5 2.8 7.8 1.3 9.4-1.2 1.4-2.8 1.5-4.4-.1l-1.3-1.3h-3.4L9 15.8c-1.6 1.6-3.2 1.5-4.4.1-1.5-1.6-.3-7.9 1.3-9.4Z"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.4 9.4v3.4"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Path
        d="M6.7 11.1h3.4"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Circle cx={15.6} cy={9.7} r={1} fill={color} />
      <Circle cx={17.3} cy={11.4} r={1} fill={color} />
      <Circle cx={13.9} cy={11.4} r={1} fill={color} />
      <Path
        d="M12.6 14.4h2.8v4.7l-1.4-1-1.4 1v-4.7Z"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
