import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };
  const { uid } = event.pathParameters || {};

  try {
    if (!authorization) {
      console.error("STEP DELETE ERROR: Não autorizado: token de autenticação ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("STEP DELETE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    // Verifica se existe
    const step = await database.client.step.findUnique({ where: { uid }, include: { leads: true, clients: true } });
    if (!step) {
      console.error("STEP DELETE ERROR: Etapa não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Etapa não encontrada.",
        }),
      };
    }

    if (step.leads.length > 0) {
      console.error("STEP DELETE ERROR: Etapa não pode ser deletada, pois possui leads associados.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Etapa não pode ser deletada, pois possui leads associados.",
        }),
      };
    }

     if (step.clients.length > 0) {
      console.error("STEP DELETE ERROR: Etapa não pode ser deletada, pois possui clientes associados.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Etapa não pode ser deletada, pois possui clientes associados.",
        }),
      };
    }


    await database.client.step.delete({ where: { uid } });
    console.log("STEP DELETE SUCCESS: Etapa deletada com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Etapa deletada com sucesso.",
      }),
    };
  } catch (error) {
    console.error("STEP DELETE ERROR: Falha ao deletar etapa.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao deletar etapa. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
