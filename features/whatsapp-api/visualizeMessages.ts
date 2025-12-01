import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };

  const { remoteJid } = JSON.parse(event.body || "");

  try {
    if (!authorization) {
      console.error("EVOLUTION VISUALIZE MESSAGES ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("EVOLUTION VISUALIZE MESSAGES ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!remoteJid) {
      console.error("EVOLUTION VISUALIZE MESSAGES ERROR: Campos obrigatórios não informados (whatsapp).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (whatsapp).",
        }),
      };
    }

    const user = await database.client.user.findUnique({
      where: {
        uid: authorization.data.masterUid,
      },
      select: {
        profile: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!user || !user.profile || !user.profile.email) {
      console.error("EVOLUTION VISUALIZE MESSAGES ERROR: Usuário não encontrado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    // Busca apenas mensagens não lidas que satisfaçam todos os critérios (AND)
    const unreadMessages = await database.client.tempMessage.findMany({
      where: {
        remoteJid,
        fromMe: false,
        userUid: authorization.data.masterUid,
      },
    });

    console.log("EVOLUTION VISUALIZE MESSAGES LOG: Mensagens não lidas encontradas.", unreadMessages);

    const readMessages = unreadMessages.map((message) => ({
      id: message.id,
      remoteJid: message.remoteJid,
      fromMe: message.fromMe,
    }));

    console.log("EVOLUTION VISUALIZE MESSAGES LOG: Marcando mensagens como lidas.", readMessages);

    try {
      // Marca como lidas as mensagens não lidas
      if (readMessages.length > 0) {
        await axios.post(
          `${process.env.ALLDO_ASSISTENTE_BASE_URL}/chat/markMessageAsRead/${user.profile.email}`,
          { readMessages },
          {
            headers: {
              apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
            },
          }
        );

        await database.client.tempMessage.deleteMany({
          where: {
            id: {
              in: readMessages.map((message) => message.id),
            },
          },
        });
      }
    } catch (error) {
      console.error(`EVOLUTION VISUALIZE MESSAGES ERROR: Falha ao visualizar mensagens do chat.`, error);

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha ao visualizar mensagens do chat. Tente novamente mais tarde.",
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Mensagens visualizadas com sucesso.",
      }),
    };
  } catch (error) {
    console.error("EVOLUTION VISUALIZE MESSAGES ERROR: Falha ao visualizar as mensagens. ", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao visualizar as mensagens. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
