import { AppFrame } from '@cheesejs/frontend';
import { themesConfig } from '@cheesejs/themes';
import { useSettingsStore } from './store/storeHooks';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';

function AppWrapper() {
  const { themeName, uiFontSize } = useSettingsStore();
  const theme = themesConfig[themeName];

  return (
    <AppFrame
      themeName={theme?.name ?? themeName}
      darkMode={theme?.type === 'dark'}
      uiFontSize={uiFontSize}
    >
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AppFrame>
  );
}

export default AppWrapper;
