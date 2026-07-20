import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export function useResponsive() {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };
    
    const dimensionsHandler = Platform.OS === 'web' 
      ? Dimensions.addEventListener('change', onChange)
      : null;
      
    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, []);
  
  const isDesktop = Platform.OS === 'web' && screenWidth >= 1024;
  const isTablet = Platform.OS === 'web' && screenWidth >= 768 && screenWidth < 1024;
  const isMobile = !isDesktop && !isTablet;
  
  return {
    screenWidth,
    isDesktop,
    isTablet,
    isMobile,
  };
}
