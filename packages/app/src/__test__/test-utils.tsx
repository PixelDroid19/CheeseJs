/**
 * Shared test utilities for React component testing.
 * Provides a custom render function with common providers and mocks.
 */
import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement } from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

// Initialize a test-only i18n instance that returns keys as values
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: {} },
  },
  interpolation: { escapeValue: false },
  // Return the key itself (or default value) so tests can assert on translation keys
  parseMissingKeyHandler: (key: string) => key,
});

/**
 * Mock for window.codeRunner used across multiple tests.
 */
export function createMockCodeRunner() {
  return {
    execute: vi.fn().mockResolvedValue({ success: true }),
    cancel: vi.fn(),
    waitForReady: vi.fn().mockResolvedValue(true),
    onResult: vi.fn().mockReturnValue(vi.fn()),
    onInputRequest: vi.fn().mockReturnValue(vi.fn()),
    onJSInputRequest: vi.fn().mockReturnValue(vi.fn()),
    sendInputResponse: vi.fn(),
  };
}

/**
 * Mock for window.packageManager.
 */
export function createMockPackageManager() {
  return {
    install: vi.fn().mockResolvedValue({ success: true, version: '1.0.0' }),
    uninstall: vi.fn().mockResolvedValue({ success: true }),
    list: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Mock for window.localStorage (already available in jsdom but
 * useful for resetting between tests).
 */
export function clearLocalStorage() {
  window.localStorage.clear();
}

/**
 * Custom render that wraps components with I18nextProvider.
 * Extend this with additional providers as needed.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };
