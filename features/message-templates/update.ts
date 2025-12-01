import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

interface MetaTemplateResponse {
  id?: string;
  name?: string;
  category?: string;
  status?: string;
  language?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// Função para buscar template na Meta API
const getTemplateFromMeta = async (
  metaTemplateId: string,
  accessToken: string
): Promise<MetaTemplateResponse> => {
  try {
    const metaApiUrl = `https://graph.facebook.com/v18.0/${metaTemplateId}?fields=id,name,category,status,language`;

    const response = await fetch(metaApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const responseData = (await response.json()) as MetaTemplateResponse;

    if (!response.ok) {
      console.error("Meta API Get Template Error:", responseData);
      return {
        error: {
          message:
            responseData.error?.message || "Erro desconhecido da API da Meta",
          type: responseData.error?.type || "unknown_error",
          code: responseData.error?.code || response.status,
        },
      };
    }

    return responseData;
  } catch (error) {
    console.error("Erro ao buscar template da Meta:", error);
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
        "MESSAGE TEMPLATE UPDATE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!uid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "UID do template é obrigatório.",
        }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    console.log(body, "---BODY---");
    console.log(uid, "---UID---");

    const existingTemplate = await database.client.messageTemplate.findFirst({
      where: {
        metaTemplateId: uid,
      },
    });

    if (!existingTemplate) {
      console.error("MESSAGE TEMPLATE UPDATE ERROR: Template não encontrado.", {
        metaTemplateId: uid,
      });
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Template não encontrado.",
        }),
      };
    }

    // Buscar configurações do WhatsApp Business
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

    let metaTemplateData: MetaTemplateResponse | null = null;

    // Se temos as configurações necessárias, buscar dados atualizados da Meta
    if (whatsappBusinessIdConfig && metaAccessTokenConfig) {
      console.log("Buscando dados atualizados do template na Meta API...");

      metaTemplateData = await getTemplateFromMeta(uid, metaAccessTokenConfig);

      if (metaTemplateData.error) {
        console.warn(
          "Aviso: Não foi possível buscar dados da Meta API:",
          metaTemplateData.error.message
        );
        // Continua com o update mesmo se não conseguir buscar da Meta
      } else {
        console.log("Dados do template obtidos da Meta:", metaTemplateData);
      }
    } else {
      console.warn(
        "Configurações do WhatsApp Business não encontradas. Continuando sem sincronização com Meta."
      );
    }

    const updateData: any = {};

    // Atualizar status se fornecido no body
    if (body.status && body.status !== existingTemplate.status) {
      updateData.status = body.status;
    }

    // Se conseguimos buscar dados da Meta, comparar e atualizar categoria se necessário
    if (
      metaTemplateData &&
      !metaTemplateData.error &&
      metaTemplateData.category
    ) {
      if (metaTemplateData.category !== existingTemplate.category) {
        console.log(
          `Categoria diferente detectada. Banco: ${existingTemplate.category}, Meta: ${metaTemplateData.category}`
        );
        updateData.category = metaTemplateData.category;
      }

      // Também podemos sincronizar o status da Meta se não foi fornecido no body
      if (
        !body.status &&
        metaTemplateData.status &&
        metaTemplateData.status !== existingTemplate.status
      ) {
        console.log(
          `Status diferente detectado. Banco: ${existingTemplate.status}, Meta: ${metaTemplateData.status}`
        );
        updateData.status = metaTemplateData.status;
      }
    }

    const updatedTemplate = await database.client.messageTemplate.update({
      where: { uid: existingTemplate.uid },
      data: updateData,
    });

    console.log("MESSAGE TEMPLATE UPDATE SUCCESS:", {
      uid: updatedTemplate.uid,
      name: updatedTemplate.name,
      updatedFields: Object.keys(updateData),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: updatedTemplate,
        msg: "Template atualizado com sucesso.",
        syncedWithMeta:
          metaTemplateData && !metaTemplateData.error ? true : false,
      }),
    };
  } catch (error) {
    console.error("MESSAGE TEMPLATE UPDATE ERROR:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno do servidor.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
