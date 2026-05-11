import { InputTooltipOverlay } from '@cheesejs/runtime-shell';
import { hostBridge } from '../host/hostBridge';

interface InputTooltipProps {
  /** Callback to get line position from editor */
  getLineTop?: (line: number) => number | null;
}

export function InputTooltip({ getLineTop }: InputTooltipProps) {
  return (
    <InputTooltipOverlay
      codeRunner={hostBridge.codeRunner}
      getLineTop={getLineTop}
    />
  );
}

export default InputTooltip;
