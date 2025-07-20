import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';

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

      // Simple action object (temporary - will be enhanced later)
      const action = {
        id: actionId,
        title: actionTitle,
        type: 'streamdeck-action',
        createdAt: new Date().toISOString(),
      };

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
