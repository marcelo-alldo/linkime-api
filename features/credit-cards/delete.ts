import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const { uid } = event.pathParameters || {};
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("CREDIT CARD DELETE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    await database.client.userCreditCard.delete({
      where: {
        uid,
      },
    });

    console.log("CREDIT CARD DELETE SUCCESS: Cartão de crédito deletado com sucesso.", { uid });
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Cartão de crédito deletado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("CREDIT CARD DELETE ERROR: Erro interno do servidor.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno do servidor.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
