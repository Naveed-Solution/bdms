import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomAlert, { AlertButton } from '../components/CustomAlert';

interface AlertOptions {
  title: string;
  message: string;
  buttons?: AlertButton[];
  type?: 'success' | 'error' | 'warning' | 'info';
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
  children: ReactNode;
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions>({
    title: '',
    message: '',
    buttons: [],
    type: 'info',
  });

  const showAlert = (options: AlertOptions) => {
    setAlertOptions(options);
    setAlertVisible(true);
  };

  const hideAlert = () => {
    setAlertVisible(false);
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert
        visible={alertVisible}
        title={alertOptions.title}
        message={alertOptions.message}
        buttons={alertOptions.buttons}
        type={alertOptions.type}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  
  return context;
}

