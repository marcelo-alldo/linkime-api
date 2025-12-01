import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as { success: boolean; data: any };
    if (!authorization?.success) {
      console.error("TAG GET ERROR: Não autorizado: token de autenticação ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
      success: boolean;
    };
    if (!subscriptionMiddleware.success) {
      console.error("TAG GET ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const tags = await database.client.tag.findMany({
      where: {
        userUid: authorization.data.masterUid
      },
      orderBy: {
        name: "asc",
      },
      select: {
        uid: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log("TAG GET SUCCESS: Tags recuperadas com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: tags,
      }),
    };
  } catch (error) {
    console.error("TAG GET ERROR: Falha ao recuperar tags.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar tags. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};