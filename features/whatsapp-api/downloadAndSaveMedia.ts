import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";
import axios from "axios";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    // Autenticação
    const authorization = (await auth(event)) as {
      success: boolean;
      data: any;
    };

    if (!authorization || !authorization.success) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autorização ausente ou inválido.",
        }),
      };
    }

    // Verificar assinatura
    const subscriptionMiddleware = (await subscription(
      authorization.data.masterUid
    )) as {
      success: boolean;
    };

    if (!subscriptionMiddleware.success) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    // Parse do body
    const { mediaId } = JSON.parse(event.body || "{}");

    if (!mediaId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "URL da mídia e Media ID são obrigatórios.",
        }),
      };
    }

    // Buscar configurações do WhatsApp
    const userMaster = await database.client.user.findUnique({
      where: {
        uid: authorization.data.masterUid,
      },
      select: {
        configs: {
          where: {
            OR: [{ key: "WHATSAPP-PHONE-ID" }, { key: "WHATSAPP" }],
          },
        },
      },
    });

    if (!userMaster || !userMaster.configs.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Configuração do WhatsApp não encontrada.",
        }),
      };
    }

    if (!process.env.WHATSAPP_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Token do WhatsApp não configurado.",
        }),
      };
    }

    // 1. Obter a URL da mídia usando a API do WhatsApp
    const mediaUrlResponse = await axios.get(
      `https://graph.facebook.com/v22.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      }
    );

    const mediaUrl = mediaUrlResponse.data.url;
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      responseType: "arraybuffer",
    });

    console.log("RESPONSE DA MEDIA URL", mediaResponse);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: mediaResponse.data,
      }),
    };
  } catch (error: any) {
    console.error("WHATSAPP DOWNLOAD MEDIA ERROR:", error);

    // Erro da API do WhatsApp
    if (error.response?.data) {
      const whatsappError = error.response.data.error;
      return {
        statusCode: error.response.status || 500,
        body: JSON.stringify({
          success: false,
          msg: `Erro da API do WhatsApp: ${
            whatsappError?.message || "Erro desconhecido"
          }`,
          errorCode: whatsappError?.code,
          errorType: whatsappError?.type,
          errorDetails: whatsappError?.error_data,
        }),
      };
    }

    // Erro de download
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha na conexão ao baixar a mídia.",
          error: error.message,
        }),
      };
    }

    // Erro genérico
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao baixar e salvar mídia.",
        error: error.message,
      }),
    };
  } finally {
    await database.disconnect();
  }
};
