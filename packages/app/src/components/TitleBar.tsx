import { TitleBar as FrontendTitleBar } from '@cheesejs/frontend';
import { hostBridge } from '../host/hostBridge';

export function TitleBar() {
  return (
    <FrontendTitleBar
      onMinimize={() => hostBridge.windowControls.minimizeApp()}
      onMaximize={() => hostBridge.windowControls.maximizeApp()}
      onClose={() => hostBridge.windowControls.closeApp()}
    />
  );
}
