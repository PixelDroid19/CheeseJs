import { TitleBar as FrontendTitleBar } from '@cheesejs/frontend';

export function TitleBar() {
  return (
    <FrontendTitleBar
      onMinimize={() => window.electronAPI.minimizeApp()}
      onMaximize={() => window.electronAPI.maximizeApp()}
      onClose={() => window.electronAPI.closeApp()}
    />
  );
}
