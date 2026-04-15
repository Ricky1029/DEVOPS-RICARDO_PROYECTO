/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Paleta principal
const primaryBlue = '#1a3a6b';
const secondaryBlue = '#007bff';
const lightBlue = '#e7f3ff';
const darkGray = '#525f7f';
const lightGray = '#f0f4f8';
const white = '#ffffff';

export const Colors = {
  light: {
    text: darkGray,
    textDark: '#0A2540',
    background: white,
    backgroundAlt: lightGray,
    tint: secondaryBlue,
    primary: primaryBlue,
    secondary: secondaryBlue,
    accent: lightBlue,
    gray: darkGray,
    grayLight: lightGray,
    border: '#dfe4ea',
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    icon: darkGray,
    tabIconDefault: darkGray,
    tabIconSelected: secondaryBlue,
  },
  dark: {
    text: '#ECEDEE',
    textDark: '#FFFFFF',
    background: '#151718',
    backgroundAlt: '#1E2122',
    tint: secondaryBlue,
    primary: primaryBlue,
    secondary: secondaryBlue,
    accent: '#1E3A5F',
    gray: '#9BA1A6',
    grayLight: '#2A2D2E',
    border: '#2A2D2E',
    success: '#2E8B57',
    error: '#CD5C5C',
    warning: '#DAA520',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: secondaryBlue,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
