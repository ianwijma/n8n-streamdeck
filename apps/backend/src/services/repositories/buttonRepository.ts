import { Button, ButtonActionType } from '../../../generated/prisma';
import { databaseService } from '../databaseService';

export class ButtonRepository {
  private prisma = databaseService.getClient();

  async findByDeviceId(deviceId: string): Promise<Button[]> {
    return this.prisma.button.findMany({
      where: { deviceId },
      orderBy: { index: 'asc' },
    });
  }

  async findById(id: string): Promise<Button | null> {
    return this.prisma.button.findUnique({
      where: { id },
      include: {
        device: true,
        folders: {
          include: {
            folder: true,
          },
        },
      },
    });
  }

  async findByDeviceAndIndex(
    deviceId: string,
    index: number
  ): Promise<Button | null> {
    return this.prisma.button.findUnique({
      where: {
        deviceId_index: {
          deviceId,
          index,
        },
      },
    });
  }

  async create(data: {
    deviceId: string;
    index: number;
    label?: string;
    icon?: string;
    iconData?: Buffer;
    actionType?: ButtonActionType;
    actionPayload?: string;
    n8nWorkflowId?: string;
    webhookUrl?: string;
    command?: string;
    hotkey?: string;
    isEnabled?: boolean;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
  }): Promise<Button> {
    return this.prisma.button.create({
      data,
    });
  }

  async update(
    id: string,
    data: Partial<{
      index: number;
      label: string;
      icon: string;
      iconData: Buffer;
      actionType: ButtonActionType;
      actionPayload: string;
      n8nWorkflowId: string;
      webhookUrl: string;
      command: string;
      hotkey: string;
      isEnabled: boolean;
      backgroundColor: string;
      textColor: string;
      fontSize: number;
    }>
  ): Promise<Button> {
    return this.prisma.button.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Button> {
    return this.prisma.button.delete({
      where: { id },
    });
  }

  async deleteByDeviceId(deviceId: string): Promise<{ count: number }> {
    return this.prisma.button.deleteMany({
      where: { deviceId },
    });
  }

  async createDefaultButtons(
    deviceId: string,
    buttonCount: number
  ): Promise<Button[]> {
    const buttons: Button[] = [];

    for (let i = 0; i < buttonCount; i++) {
      const button = await this.create({
        deviceId,
        index: i,
        isEnabled: true,
      });
      buttons.push(button);
    }

    return buttons;
  }

  async findByAction(
    actionType: ButtonActionType,
    n8nWorkflowId?: string
  ): Promise<Button[]> {
    const where: any = { actionType };

    if (n8nWorkflowId) {
      where.n8nWorkflowId = n8nWorkflowId;
    }

    return this.prisma.button.findMany({
      where,
      include: {
        device: true,
      },
    });
  }
}
