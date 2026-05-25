import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BottomSheetContextType {
  bottomSheetHeight: number;
  setBottomSheetHeight: (height: number) => void;
  /** When true, tab bar should be hidden (e.g. when any SwipeableBottomSheet is visible). */
  hideTabBar: boolean;
  setHideTabBar: (hide: boolean) => void;
}

const BottomSheetContext = createContext<BottomSheetContextType | undefined>(
  undefined,
);

export const BottomSheetProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);
  const [hideTabBar, setHideTabBar] = useState(false);

  return (
    <BottomSheetContext.Provider
      value={{
        bottomSheetHeight,
        setBottomSheetHeight,
        hideTabBar,
        setHideTabBar,
      }}>
      {children}
    </BottomSheetContext.Provider>
  );
};

export const useBottomSheet = () => {
  const context = useContext(BottomSheetContext);
  if (!context) {
    throw new Error('useBottomSheet must be used within BottomSheetProvider');
  }
  return context;
};

