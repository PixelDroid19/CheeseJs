import { InputTooltipOverlay } from '@cheesejs/runtime-shell';

interface InputTooltipProps {
  /** Callback to get line position from editor */
  getLineTop?: (line: number) => number | null;
}

export function InputTooltip({ getLineTop }: InputTooltipProps) {
  return (
    <InputTooltipOverlay
      codeRunner={window.codeRunner}
      getLineTop={getLineTop}
    />
  );
}

export default InputTooltip;
