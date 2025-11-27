import ReactDOM from 'react-dom/client'
import './index.css'
import './i18n'
import AppWrapper from './AppWrapper.tsx'

// Polyfill process for browser environment (needed for some Babel plugins)
if (typeof window !== 'undefined' && !window.process) {
  // @ts-ignore
  window.process = {
    env: { NODE_ENV: 'development' },
    version: '',
    cwd: () => '/'
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
  <AppWrapper />

  // </React.StrictMode>,
)

postMessage({ payload: 'removeLoading' }, '*')
