import { APIGatewayEvent } from "aws-lambda";
import { auth } from "../middlewares/auth.middleware";
import Database from "../../database";

export const handler = async (event: APIGatewayEvent) => {
  const { uid } = event.pathParameters || {};
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const database = new Database();

  try {
    if (!authorization) {
      console.error("CREDIT CARD SET DEFAULT ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!uid) {
      console.error("CREDIT CARD SET DEFAULT ERROR: Campo obrigatório não informado (uid).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campo obrigatório não informado (uid).",
        }),
      };
    }

    await database.client.$transaction(async (prisma) => {
      await prisma.userCreditCard.updateMany({
        where: {
          userUid: authorization.data.masterUid,
          NOT: {
            uid,
          },
        },
        data: {
          isActive: false,
        },
      });

      await prisma.userCreditCard.update({
        where: {
          uid,
        },
        data: {
          isActive: true,
        },
      });
    });

    console.log("CREDIT CARD SET DEFAULT SUCCESS: Cartão de crédito atualizado como padrão.", { uid });
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Cartão de crédito atualizado como padrão.",
      }),
    };
  } catch (error) {
    console.error("CREDIT CARD SET DEFAULT ERROR: Erro interno do servidor.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno do servidor.",
      }),
    };
  } finally {
    await database.client.$disconnect();
  }
};
