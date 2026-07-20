import React from 'react';
import { Dimensions, Platform } from 'react-native';

interface ResponsiveWrapperProps {
  children: React.ReactNode;
}

export function ResponsiveWrapper({ children }: ResponsiveWrapperProps) {
  const [screenWidth, setScreenWidth] = React.useState(Dimensions.get('window').width);

  React.useEffect(() => {
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

  // Desktop support enabled - remove overlay
  // if (Platform.OS === 'web' && screenWidth > 768) {
  //   return (
  //     <ThemedView style={styles.desktopOverlay}>
  //       <View style={styles.overlayContent}>
  //         <ThemedText type="title" style={styles.title}>
  //           Please Open on Mobile
  //         </ThemedText>
  //         <ThemedText style={styles.subtitle}>
  //           The desktop version is still in development
  //         </ThemedText>
  //       </View>
  //     </ThemedView>
  //   );
  // }

  return <>{children}</>;
}