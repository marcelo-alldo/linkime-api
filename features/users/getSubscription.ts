import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error(
        "USER GET SUBSCRIPTION ERROR: Não autorizado: cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const uid = event.queryStringParameters?.uid;
    if (uid) {
      // LOG: Fetching single subscription by uid
      console.log("Fetching single subscription by uid:", uid);
      const subscription = await database.client.userSubscription.findFirst({
        where: {
          userUid: authorization?.data?.masterUid,
          subscriptionUid: uid,
        },
        include: {
          subscription: true,
          payments: true,
        },
      });
      if (!subscription) {
        console.error(
          "USER GET SUBSCRIPTION ERROR: Assinatura não encontrada."
        );
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Assinatura não encontrada.",
          }),
        };
      }
      // LOG: Single subscription retrieved
      console.log(
        "USER GET SUBSCRIPTION SUCCESS: Assinatura recuperada com sucesso.",
        subscription
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: subscription,
          msg: "Assinatura recuperada com sucesso.",
        }),
      };
    }

    const data = await database.client.userSubscription.findMany({
      where: {
        userUid: authorization.data.masterUid,
      },
      include: {
        subscription: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(
      "USER GET SUBSCRIPTION SUCCESS: Assinatura do usuário recuperada com sucesso."
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        msg: "Assinatura do usuário recuperada com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "USER GET SUBSCRIPTION ERROR: Falha ao recuperar assinatura do usuário.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar assinatura do usuário. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
