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
    const [
      leadsCount,
      clientsEnableCount,
      clientsDisableCount,
      colaboratorCount,
      messageCount,
    ] = await Promise.all([
      database.client.lead.count({
        where: { userUid: authorization?.data?.masterUid },
      }),
      database.client.client.count({
        where: {
          enable: true,
          userUid: authorization?.data?.masterUid,
        },
      }),
      database.client.client.count({
        where: {
          enable: false,
          userUid: authorization?.data?.masterUid,
        },
      }),
      database.client.collaborator.count({
        where: {
          enable: true,
          parentUid: authorization?.data?.masterUid,
        },
      }),
      database.client.scheduledMessageRecipient.count({
        where: {
          status: "PENDING",
          scheduledMessage: {
            userUid: authorization?.data?.masterUid,
          },
        },
      }),
    ]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const leadsPerMonth = Array(12).fill(0);
    const clientsPerMonth = Array(12).fill(0);

    // Buscar todos os clients do ano atual
    const clients = await database.client.client.findMany({
      where: {
        userUid: authorization?.data?.masterUid,
        createdAt: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31, 23, 59, 59, 999),
        },
      },
      select: { createdAt: true },
    });

    // Buscar todos os leads do ano atual
    const leads = await database.client.lead.findMany({
      where: {
        userUid: authorization?.data?.masterUid,
        createdAt: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31, 23, 59, 59, 999),
        },
      },
      select: { createdAt: true },
    });

    // Preencher arrays mês a mês
    clients.forEach((client) => {
      const month = client.createdAt.getMonth();
      clientsPerMonth[month]++;
    });
    leads.forEach((lead) => {
      const month = lead.createdAt.getMonth();
      leadsPerMonth[month]++;
    });

    const data = {
      totalLeads: leadsCount,
      totalClientsEnable: clientsEnableCount,
      totalClientsDisable: clientsDisableCount,
      totalCollaborators: colaboratorCount,
      totalMessages: messageCount,
      leadsPerMonth: leadsPerMonth,
      clientsPerMonth: clientsPerMonth,
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
