import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';
import { createStreamDeckAction } from '@n8n-streamdeck/shared';

export class StreamDeck implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'StreamDeck',
    name: 'streamDeck',
    icon: 'file:streamdeck.svg',
    group: ['trigger'],
    version: 1,
    description: 'Trigger workflows from StreamDeck',
    defaults: {
      name: 'StreamDeck',
    },
    inputs: [],
    outputs: [NodeConnectionType.Main],
    properties: [
      {
        displayName: 'Action ID',
        name: 'actionId',
        type: 'string',
        default: '',
        placeholder: 'my-action',
        description: 'The ID of the StreamDeck action',
      },
      {
        displayName: 'Action Title',
        name: 'actionTitle',
        type: 'string',
        default: '',
        placeholder: 'My Action',
        description: 'The title displayed on the StreamDeck button',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const actionId = this.getNodeParameter('actionId', i) as string;
      const actionTitle = this.getNodeParameter('actionTitle', i) as string;

      const action = createStreamDeckAction(actionId, actionTitle);

      returnData.push({
        json: {
          action,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return [returnData];
  }
}