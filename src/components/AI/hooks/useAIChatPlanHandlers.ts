import { useCallback } from 'react';
import { useChatStore } from '../../../store/useChatStore';
import { extractExecutionPlanFromText } from '../../../features/ai-agent/codeAgent';

interface PlanHandlersDeps {
  input: string;
  isStreaming: boolean;
  isConfigured: boolean;
  isExecutingPlan: boolean;
  activePlan: ReturnType<typeof useChatStore.getState>['activePlan'];
  setIsExecutingPlan: React.Dispatch<React.SetStateAction<boolean>>;
  setLastError: React.Dispatch<React.SetStateAction<string | null>>;
  clearActivePlan: () => void;
  setExecutionMode: (mode: 'agent' | 'plan') => void;
  handleSend: (
    textInput?: string,
    isAutoCorrection?: boolean,
    options?: {
      forcedMode?: 'agent' | 'plan' | 'verifier';
      suppressUserMessage?: boolean;
      skipCloudWarning?: boolean;
      structuredPlanOutput?: boolean;
    }
  ) => Promise<string | undefined>;
  setActivePlan: ReturnType<typeof useChatStore.getState>['setActivePlan'];
  addMessage: ReturnType<typeof useChatStore.getState>['addMessage'];
  setPlanStatus: ReturnType<typeof useChatStore.getState>['setPlanStatus'];
  setCurrentPlanTaskIndex: ReturnType<typeof useChatStore.getState>['setCurrentPlanTaskIndex'];
  updatePlanTaskStatus: ReturnType<typeof useChatStore.getState>['updatePlanTaskStatus'];
}

export function useAIChatPlanHandlers(deps: PlanHandlersDeps) {
  const handleGeneratePlan = useCallback(async () => {
    const goal = deps.input.trim();
    if (!goal || deps.isStreaming || !deps.isConfigured) return;

    deps.clearActivePlan();
    deps.setExecutionMode('plan');

    const assistantText = await deps.handleSend(goal, false, {
      forcedMode: 'plan',
      structuredPlanOutput: true,
    });

    if (!assistantText) {
      deps.setLastError('No plan response received from the agent.');
      return;
    }

    const parsedPlan = extractExecutionPlanFromText(assistantText);
    if (!parsedPlan) {
      deps.setLastError(
        'The plan response was not structured correctly. Please try again.'
      );
      deps.addMessage({
        role: 'system',
        content:
          'Plan parsing failed. Try requesting the plan again with more explicit scope.',
      });
      return;
    }

    deps.setActivePlan(parsedPlan);
    deps.addMessage({
      role: 'system',
      content: `Plan ready: ${parsedPlan.tasks.length} tasks prepared. Review and click "Execute plan" when ready.`,
    });
  }, [deps]);

  const handleExecutePlan = useCallback(async () => {
    if (!deps.activePlan || deps.activePlan.tasks.length === 0 || deps.isExecutingPlan)
      return;

    deps.setIsExecutingPlan(true);
    deps.setPlanStatus('running');

    for (let i = 0; i < deps.activePlan.tasks.length; i += 1) {
      const task = deps.activePlan.tasks[i];
      const dependenciesDone = task.dependencies.every((dependencyId) => {
        const depTask = useChatStore
          .getState()
          .activePlan?.tasks.find((t) => t.id === dependencyId);
        return depTask?.status === 'completed';
      });

      deps.setCurrentPlanTaskIndex(i);

      if (!dependenciesDone) {
        deps.updatePlanTaskStatus(
          task.id,
          'skipped',
          'Skipped because dependencies were not completed.'
        );
        continue;
      }

      deps.updatePlanTaskStatus(task.id, 'running');
      deps.addMessage({
        role: 'system',
        content: `Executing step ${i + 1}/${deps.activePlan.tasks.length}: ${task.title}`,
      });

      const taskResult = await deps.handleSend(task.prompt, false, {
        forcedMode: 'agent',
        suppressUserMessage: true,
        skipCloudWarning: true,
      });

      if (!taskResult) {
        deps.updatePlanTaskStatus(
          task.id,
          'failed',
          'Execution failed: no response from agent.'
        );
        deps.setPlanStatus('failed');
        deps.setIsExecutingPlan(false);
        deps.setLastError(`Plan execution failed at step ${i + 1}: ${task.title}`);
        return;
      }

      deps.updatePlanTaskStatus(task.id, 'completed', taskResult.slice(0, 180));
    }

    deps.setPlanStatus('completed');
    deps.setIsExecutingPlan(false);
    deps.addMessage({
      role: 'system',
      content: 'Plan execution completed successfully.',
    });
  }, [deps]);

  return {
    handleGeneratePlan,
    handleExecutePlan,
  };
}
