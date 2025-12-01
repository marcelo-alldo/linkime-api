import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

interface MetaApiDeleteResponse {
  success?: boolean;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

const deleteTemplateFromMeta = async (
  whatsappBusinessAccountId: string,
  metaTemplateId: string,
  templateName: string,
  accessToken: string
): Promise<MetaApiDeleteResponse> => {
  try {
    const metaApiUrl = `https://graph.facebook.com/v23.0/${whatsappBusinessAccountId}/message_templates?hsm_id=${metaTemplateId}&name=${templateName}`;

    const response = await fetch(metaApiUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const responseData = (await response.json()) as MetaApiDeleteResponse;

    if (!response.ok) {
      console.error("Meta API Delete Error:", responseData);
      return {
        error: {
          message:
            responseData.error?.message || "Erro desconhecido da API da Meta",
          type: responseData.error?.type || "unknown_error",
          code: responseData.error?.code || response.status,
        },
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar template da Meta:", error);
    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Erro de conexão com a API da Meta",
        type: "network_error",
        code: 500,
      },
    };
  }
};

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const { uid } = event.pathParameters || {};
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error(
        "MESSAGE TEMPLATE DELETE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const messageTemplate = await database.client.messageTemplate.findUnique({
      where: { uid },
      select: {
        uid: true,
        name: true,
        metaTemplateId: true,
        userUid: true,
      },
    });

    if (!messageTemplate) {
      console.error("MESSAGE TEMPLATE DELETE ERROR: Template não encontrado.", {
        uid,
      });
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Template não encontrado.",
        }),
      };
    }

    const scheduledMessagesUsingTemplate = await database.client.scheduledMessage.findMany({
      where: {
        messageTemplateUid: uid,
      },
      select: {
        uid: true,
        title: true,
      },
    });

    if (scheduledMessagesUsingTemplate.length > 0) {
      console.error("MESSAGE TEMPLATE DELETE ERROR: Template está sendo usado em mensagens agendadas.", {
        uid,
        scheduledMessagesCount: scheduledMessagesUsingTemplate.length,
      });
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: `Não é possível excluir este template pois ele está sendo usado em ${scheduledMessagesUsingTemplate.length} mensagem(ns) agendada(s).`,
          relatedScheduledMessages: scheduledMessagesUsingTemplate,
        }),
      };
    }

    const whatsappConfigs = await database.client.userConfig.findMany({
      where: {
        userUid: authorization.data.masterUid,
        key: { in: ["WHATSAPP-ACCOUNT-ID"] },
      },
    });

    const whatsappBusinessIdConfig = whatsappConfigs.find(
      (config) => config.key === "WHATSAPP-ACCOUNT-ID"
    );
    const metaAccessTokenConfig = process.env.WHATSAPP_TOKEN;

    if (
      messageTemplate.metaTemplateId &&
      whatsappBusinessIdConfig &&
      metaAccessTokenConfig
    ) {
      console.log(
        "MESSAGE TEMPLATE DELETE: Deletando template da Meta primeiro.",
        {
          metaTemplateId: messageTemplate.metaTemplateId,
          templateName: messageTemplate.name,
        }
      );

      const metaDeleteResult = await deleteTemplateFromMeta(
        whatsappBusinessIdConfig.value,
        messageTemplate.metaTemplateId,
        messageTemplate.name,
        metaAccessTokenConfig
      );

      if (metaDeleteResult.error) {
        console.error(
          "MESSAGE TEMPLATE DELETE ERROR: Falha ao deletar da Meta:",
          metaDeleteResult.error
        );
      } else {
        console.log(
          "MESSAGE TEMPLATE DELETE SUCCESS: Template deletado da Meta com sucesso."
        );
      }
    } else {
      console.log(
        "MESSAGE TEMPLATE DELETE INFO: Template não possui metaTemplateId ou configurações da Meta não encontradas. Deletando apenas do banco."
      );
    }

    await database.client.messageTemplate.delete({
      where: { uid },
    });

    console.log(
      "MESSAGE TEMPLATE DELETE SUCCESS: Modelo de mensagem deletado com sucesso.",
      { uid }
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Modelo de mensagem deletado com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "MESSAGE TEMPLATE DELETE ERROR: Erro interno do servidor.",
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
