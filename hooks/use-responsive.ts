import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export type BreakpointSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWeb: boolean;
  currentBreakpoint: BreakpointSize;
}

const BREAKPOINTS = {
  xs: 0,    // Mobile portrait
  sm: 576,  // Mobile landscape
  md: 768,  // Tablet portrait
  lg: 992,  // Tablet landscape / Small desktop
  xl: 1200, // Desktop
};

export const useResponsive = (): ResponsiveInfo => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const isWeb = Platform.OS === 'web';

  const isXs = width < BREAKPOINTS.sm;
  const isSm = width >= BREAKPOINTS.sm && width < BREAKPOINTS.md;
  const isMd = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
  const isLg = width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl;
  const isXl = width >= BREAKPOINTS.xl;

  const isMobile = isXs || isSm;
  const isTablet = isMd;
  const isDesktop = isLg || isXl;

  let currentBreakpoint: BreakpointSize = 'xs';
  if (isXl) currentBreakpoint = 'xl';
  else if (isLg) currentBreakpoint = 'lg';
  else if (isMd) currentBreakpoint = 'md';
  else if (isSm) currentBreakpoint = 'sm';

  return {
    width,
    height,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isMobile,
    isTablet,
    isDesktop,
    isWeb,
    currentBreakpoint,
  };
};

// Función helper para obtener valores responsivos
export const getResponsiveValue = <T,>(
  values: Partial<Record<BreakpointSize, T>>,
  currentBreakpoint: BreakpointSize
): T | undefined => {
  const breakpointOrder: BreakpointSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  const currentIndex = breakpointOrder.indexOf(currentBreakpoint);

  // Buscar el valor más cercano hacia abajo
  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpointOrder[i];
    if (values[bp] !== undefined) {
      return values[bp];
    }
  }

  return undefined;
};
