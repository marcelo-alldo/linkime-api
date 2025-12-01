import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error(
        "ADMIN DASHBOARD: Não autorizado: cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // Consulta agregada para dashboard
    const [usersCount, freeTierCount, standardCount, customCount] =
      await Promise.all([
        database.client.user.count({ where: { type: 2 } }),
        database.client.userSubscription.count({
          where: {
            subscriptionUid: process.env.SUBSCRIPTION_FREE_TRIAL_UID,
            status: "TRIAL",
          },
        }),
        database.client.userSubscription.count({
          where: {
            subscriptionUid: process.env.SUBSCRIPTION_DEFAULT_UID,
            status: "ACTIVE",
          },
        }),
        database.client.userSubscription.count({
          where: {
            subscriptionUid: process.env.SUBSCRIPTION_CUSTOM_UID,
            status: "ACTIVE",
          },
        }),
        database.client.userSubscription.count({
          where: {
            subscriptionUid: process.env.SUBSCRIPTION_SERVICE_UID,
            status: "ACTIVE",
          },
        }),
      ]);

    // Calcula datas do início (domingo) até hoje
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    // Array para armazenar contagem por dia da semana
    const usersPerDay = Array(7).fill(0);

    // Busca todos os usuários criados a partir do início da semana
    const usersThisWeek = await database.client.user.findMany({
      where: {
        type: 2,
        createdAt: {
          gte: weekStart,
          lte: now,
        },
      },
      select: { createdAt: true },
    });

    // Conta quantos usuários em cada dia da semana
    usersThisWeek.forEach((u) => {
      const d = new Date(u.createdAt).getDay();
      usersPerDay[d]++;
    });

    const data = {
      totalUsers: usersCount,
      totalFreeTier: freeTierCount,
      totalStandard: standardCount,
      totalCustom: customCount,
      usersPerDay: {
        sunday: usersPerDay[0],
        monday: usersPerDay[1],
        tuesday: usersPerDay[2],
        wednesday: usersPerDay[3],
        thursday: usersPerDay[4],
        friday: usersPerDay[5],
        saturday: usersPerDay[6],
      },
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        msg: "Dados do dashboard recuperados com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "ADMIN DASHBOARD: Falha ao recuperar dados do dashboard.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar dados do dashboard. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
