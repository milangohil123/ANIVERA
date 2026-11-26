import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n';
import { AuthProvider } from './context/AuthContext';
import { AppRoutes } from './router';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
          <PwaInstallPrompt />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

export default App;
