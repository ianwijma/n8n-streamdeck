import { Session } from '../../../generated/prisma';
import { databaseService } from '../databaseService';

export class SessionRepository {
  private prisma = databaseService.getClient();

  async findByToken(token: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { token },
    });
  }

  async create(data: {
    userId?: string;
    token: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    isActive?: boolean;
  }): Promise<Session> {
    return this.prisma.session.create({
      data,
    });
  }

  async delete(id: string): Promise<Session> {
    return this.prisma.session.delete({
      where: { id },
    });
  }

  async deleteByToken(token: string): Promise<Session> {
    return this.prisma.session.delete({
      where: { token },
    });
  }

  async deleteExpired(): Promise<{ count: number }> {
    return this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  async deleteByUserId(userId: string): Promise<{ count: number }> {
    return this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateExpiration(token: string, expiresAt: Date): Promise<Session> {
    return this.prisma.session.update({
      where: { token },
      data: { expiresAt },
    });
  }
}
