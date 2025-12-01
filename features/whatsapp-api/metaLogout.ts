import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

interface MetaApiResponse {
  success?: boolean;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("META LOGOUT ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // Buscar configurações do WhatsApp do usuário
    const whatsappConfigs = await database.client.userConfig.findMany({
      where: {
        userUid: authorization.data.masterUid,
        key: {
          in: [
            "WHATSAPP-PHONE-ID",
            "WHATSAPP-BUSINESS-ID",
            "WHATSAPP",
            "WHATSAPP-ACCOUNT-ID",
          ],
        },
      },
    });

    if (whatsappConfigs.length === 0) {
      console.log("META LOGOUT: Nenhuma configuração do WhatsApp encontrada para excluir.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Nenhuma configuração do WhatsApp encontrada.",
        }),
      };
    }

    const metaAccessTokenConfig = process.env.WHATSAPP_TOKEN;

    if (!metaAccessTokenConfig) {
      console.error("META LOGOUT ERROR: Token de acesso Meta ausente.");
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Erro: Token de acesso Meta ausente.",
        }),
      };
    }

    // Fazer logout na Meta usando o código fornecido
    try {
      const url = "https://graph.facebook.com/v22.0/1297343891860428/subscribed_apps" + 
        `?access_token=${metaAccessTokenConfig}`;
      
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json() as MetaApiResponse;
      console.log("META LOGOUT RESPONSE:", data);

      // Verificar se houve erro na resposta da Meta
      if (data.error) {
        console.error("META LOGOUT ERROR:", data.error);
        // Continuar com a exclusão dos dados locais mesmo se houver erro na Meta
      }
    } catch (metaError) {
      console.error("META LOGOUT REQUEST ERROR:", metaError);
      // Continuar com a exclusão dos dados locais mesmo se houver erro na requisição
    }

    // Excluir todas as configurações do WhatsApp do usuário
    const deletedConfigs = await database.client.userConfig.deleteMany({
      where: {
        userUid: authorization.data.masterUid,
        key: {
          in: [
            "WHATSAPP-PHONE-ID",
            "WHATSAPP-BUSINESS-ID",
            "WHATSAPP",
            "WHATSAPP-ACCOUNT-ID",
          ],
        },
      },
    });

    console.log(`META LOGOUT SUCCESS: ${deletedConfigs.count} configurações do WhatsApp excluídas.`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: `Logout realizado com sucesso. ${deletedConfigs.count} configurações do WhatsApp foram excluídas.`,
        deletedConfigs: deletedConfigs.count,
      }),
    };
  } catch (error) {
    console.error("META LOGOUT ERROR: Falha ao realizar logout.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao realizar logout. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};