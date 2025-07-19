export interface StreamDeckAction {
  id: string;
  title: string;
  icon?: string;
  context?: string;
}

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
}

export interface StreamDeckEvent {
  action: string;
  context: string;
  device: string;
  payload: Record<string, any>;
}

export const createStreamDeckAction = (
  id: string,
  title: string,
  icon?: string
): StreamDeckAction => ({
  id,
  title,
  icon,
});

export const isValidWorkflow = (workflow: any): workflow is N8NWorkflow => {
  return (
    typeof workflow === 'object' &&
    typeof workflow.id === 'string' &&
    typeof workflow.name === 'string' &&
    typeof workflow.active === 'boolean'
  );
};