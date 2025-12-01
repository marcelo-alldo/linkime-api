import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };

  try {
    if (!authorization) {
      console.error("LEAD DELETE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("LEAD DELETE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!uid) {
      console.error("LEAD DELETE ERROR: Campo obrigatório não informado (uid).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campo obrigatório não informado (uid).",
        }),
      };
    }

    // LOG: Deleting lead with uid
    console.log("Deleting lead with uid:", uid);

    const deleted = await database.client.lead.delete({
      where: { uid },
    });

    // LOG: Lead deleted
    console.log("LEAD DELETE SUCCESS: Lead deletado com sucesso.", deleted);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Lead deletado com sucesso.",
        data: deleted,
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("LEAD DELETE ERROR: Falha ao deletar lead.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao deletar lead. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
