import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("CREDIT CARD GET ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const userCreditCards = await database.client.userCreditCard.findMany({
      where: {
        userUid: authorization.data.masterUid,
      },
      select: {
        creditCardBrand: true,
        creditCardNumber: true,
        uid: true,
        cardName: true,
        isActive: true,
      },
    });

    console.log("CREDIT CARD GET SUCCESS: Cartões de crédito recuperados com sucesso.", userCreditCards);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: userCreditCards,
        msg: "Cartões de crédito recuperados com sucesso.",
      }),
    };
  } catch (error) {
    console.error("CREDIT CARD GET ERROR: Erro interno do servidor.", error);
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
