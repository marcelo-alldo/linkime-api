import { PrismaClient } from "@prisma/client";

class Database {
  public client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
    // this.client = new PrismaClient({
    //   log: ["query", "info", "warn", "error"],
    // });
  }

  async executeQuery(queryFunction: () => Promise<any>): Promise<any> {
    try {
      return await queryFunction();
    } finally {
      await this.client.$disconnect();
    }
  }

  async disconnect() {
    await this.client.$disconnect();
  }
}

export default Database;
