import { AppFrame } from '@cheesejs/frontend';
import { useSettingsStore } from './store/storeHooks';
import { themesConfig } from './themes';
import ErrorBoundary from './components/ErrorBoundary';
import { TitleBar } from './components/TitleBar';
import App from './App';

function AppWrapper() {
  const { themeName, uiFontSize } = useSettingsStore();
  const theme = themesConfig[themeName];

  return (
    <AppFrame
      titleBar={<TitleBar />}
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
