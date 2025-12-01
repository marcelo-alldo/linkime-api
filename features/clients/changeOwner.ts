import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};
  const body = JSON.parse(event.body || "{}");
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };

  try {
    if (!authorization) {
      console.error("CLIENT CHANGE OWNER ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("CLIENT CHANGE OWNER ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!uid) {
      console.error("CLIENT CHANGE OWNER ERROR: Campos obrigatórios não informados (uid).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados: uid.",
        }),
      };
    }

    // LOG: Received parameters
    console.log("Received uid:", uid);
    console.log("OwnerUid recebido:", body.ownerUid);

    // LOG: Iniciando transação para atualizar proprietário do client
    const updatedOwner = await database.client.$transaction(async (prisma) => {
      console.log("Updating owner on clientUid:", { uid });

      return await prisma.client.update({
        where: { uid },
        data: {
          ownerUid: body.ownerUid || authorization.data.userUid,
        },
      });
    });

    // LOG: Updated client result
    console.log("Updated client:", updatedOwner);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: updatedOwner,
        msg: "Atendente do Cliente atualizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("CLIENT CHANGE OWNER ERROR: Falha ao atualizar atendente do cliente.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar atendente do cliente. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};