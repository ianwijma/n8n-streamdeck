import { Device, DeviceType } from '../../../generated/prisma';
import { databaseService } from '../databaseService';

export class DeviceRepository {
  private prisma = databaseService.getClient();

  async findAll(includeDisconnected = true): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: includeDisconnected ? {} : { isConnected: true },
      include: {
        buttons: true,
        folders: true,
        profiles: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Device | null> {
    return this.prisma.device.findUnique({
      where: { id },
      include: {
        buttons: {
          orderBy: { index: 'asc' },
        },
        folders: true,
        profiles: true,
      },
    });
  }

  async findBySerialNumber(serialNumber: string): Promise<Device | null> {
    return this.prisma.device.findUnique({
      where: { serialNumber },
      include: {
        buttons: {
          orderBy: { index: 'asc' },
        },
        folders: true,
        profiles: true,
      },
    });
  }

  async create(data: {
    name: string;
    type: DeviceType;
    serialNumber: string;
    buttonCount: number;
    firmwareVersion?: string;
    brightness?: number;
  }): Promise<Device> {
    return this.prisma.device.create({
      data,
      include: {
        buttons: true,
        folders: true,
        profiles: true,
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      isConnected: boolean;
      firmwareVersion: string;
      brightness: number;
    }>
  ): Promise<Device> {
    return this.prisma.device.update({
      where: { id },
      data,
      include: {
        buttons: true,
        folders: true,
        profiles: true,
      },
    });
  }

  async delete(id: string): Promise<Device> {
    return this.prisma.device.delete({
      where: { id },
    });
  }

  async updateConnectionStatus(
    id: string,
    isConnected: boolean
  ): Promise<Device> {
    return this.prisma.device.update({
      where: { id },
      data: { isConnected },
    });
  }

  async findConnectedDevices(): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { isConnected: true },
      include: {
        buttons: {
          orderBy: { index: 'asc' },
        },
        folders: true,
        profiles: true,
      },
    });
  }
}
