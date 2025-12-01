import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(authorization?.data?.masterUid)) as { success: boolean };
  const { entity, uid } = event.pathParameters || {} as { entity?: string; uid?: string };

  try {
    if (!authorization) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido." }),
      };
    }

    if (!subscriptionMiddleware.success) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, msg: "Assinatura inválida ou expirada." }),
      };
    }

    if (!uid || !entity) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, msg: "Requisição inválida: Campos obrigatórios não informados (entity, uid)." }),
      };
    }

    if (!["leads", "clients"].includes(entity)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, msg: "Entidade inválida: use 'leads' ou 'clients'." }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const archived = body?.archived;

    if (typeof archived !== "boolean") {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, msg: "Requisição inválida: Campo 'archived' deve ser booleano no corpo." }),
      };
    }

    if (entity === "leads") {
      await database.client.lead.update({ where: { uid }, data: { archived } });
    } else {
      await database.client.client.update({ where: { uid }, data: { archived } });
    }

    const tipo = entity === "leads" ? "Lead" : "Cliente";
    const acao = archived ? "arquivado" : "desarquivado";

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, msg: `${tipo} ${acao} com sucesso.` }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, msg: "Falha ao atualizar arquivamento. Por favor, tente novamente mais tarde." }),
    };
  } finally {
    await database.disconnect();
  }
};