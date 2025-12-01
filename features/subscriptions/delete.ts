import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { doDelete } from "../../sources/alldo-payments/api";

export const handler = async (event: APIGatewayEvent) => {
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};

  if (!uid) {
    console.error("DELETE SUBSCRIPTION ERROR: UID ausente.");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "UID ausente.",
      }),
    };
  }

  const database = new Database();

  let response;

  try {
    if (!authorization) {
      console.error(
        "DELETE SUBSCRIPTION ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    try {
      const userSubscription = await database.client.userSubscription.findFirst({
        where: {
          userUid: authorization.data.masterUid,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!userSubscription) {
        console.error("DELETE SUBSCRIPTION ERROR: Assinatura não encontrada.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Assinatura não encontrada.",
          }),
        };
      }

      // Verificar se a assinatura já está cancelada
      if (userSubscription.status === "CANCELED") {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            msg: "Assinatura já está cancelada.",
          }),
        };
      }

      // Chamar API externa para cancelar
      response = await doDelete(`/subscriptions/${uid}`);

      console.log("DELETE SUBSCRIPTION RESPONSE", response);

      if (response.success !== true) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg: "Erro ao cancelar a assinatura na API externa.",
          }),
        };
      }

      // Atualizar status da assinatura no banco
      await database.client.userSubscription.update({
        where: { uid: userSubscription.uid },
        data: {
          status: "CANCELED",
          endDate: new Date(),
        },
      });
    } catch (error) {
      console.log("DELETE SUBSCRIPTION ERROR", error);
      console.log("DELETE SUBSCRIPTION RESPONSE ERROR", response);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg:
            response?.data?.errors[0]?.description ||
            "Erro ao cancelar a assinatura.",
        }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Assinatura cancelada com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "DELETE SUBSCRIPTION ERROR: Erro interno do servidor.",
      error
    );
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
