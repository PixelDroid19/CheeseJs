/**
 * Debug utility to check WebContainer and execution environment status
 * Add this to your browser console to diagnose the issue
 */

// Check LocalStorage
const settingsStorage = localStorage.getItem('settings-storage')
console.log('📦 Settings Storage:', JSON.parse(settingsStorage || '{}'))

// Check WebContainer store
import { useWebContainerStore } from './store/useWebContainerStore'
import { useSettingsStore } from './store/useSettingsStore'

const webContainerState = useWebContainerStore.getState()
const settingsState = useSettingsStore.getState()

console.log('🔧 WebContainer State:', {
    hasWebContainer: !!webContainerState.webContainer,
    isLoading: webContainerState.isLoading,
    error: webContainerState.error
})

console.log('⚙️ Settings State:', {
    executionEnvironment: settingsState.executionEnvironment,
    showTopLevelResults: settingsState.showTopLevelResults,
    loopProtection: settingsState.loopProtection
})

// Force set to node if needed
if (settingsState.executionEnvironment !== 'node') {
    console.warn('⚠️ Execution environment is not "node", fixing...')
    settingsState.setExecutionEnvironment('node')
}
