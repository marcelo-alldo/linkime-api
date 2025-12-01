import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const key = event.queryStringParameters?.key || "";
  const uid = event.queryStringParameters?.uid;

  try {
    if (!authorization) {
      console.error("CONFIG GET ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    let configs;
    if (key && key.includes(",")) {
      // Suporte a múltiplas keys separadas por vírgula
      const keys = key
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      configs = await database.client.userConfig.findMany({
        where: {
          userUid: uid || authorization.data.masterUid,
          key: { in: keys },
        },
      });
      if (!configs || configs.length === 0) {
        console.error("CONFIG GET ERROR: Configurações não encontradas para as keys.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Configurações não encontradas para as keys informadas.",
          }),
        };
      }
      console.log("CONFIG GET SUCCESS: Configurações recuperadas com sucesso.", configs);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: configs,
          msg: "Configurações recuperadas com sucesso.",
        }),
      };
    } else {
      const filter: any = {
        userUid: uid || authorization.data.masterUid,
      };
      if (key) {
        filter.key = key;
      }
      
      // Se tiver key, busca uma configuração específica, senão busca todas
      const configs = key 
        ? await database.client.userConfig.findFirst({ where: filter })
        : await database.client.userConfig.findMany({ where: filter, orderBy: { createdAt: 'asc' } });

      if (!configs || (Array.isArray(configs) && configs.length === 0)) {
        console.error("CONFIG GET ERROR: Configuração(ões) não encontrada(s).");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Configuração(ões) não encontrada(s).",
          }),
        };
      }

      console.log("CONFIG GET SUCCESS: Configuração(ões) recuperada(s) com sucesso.", configs);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: configs,
          msg: "Configuração(ões) recuperada(s) com sucesso.",
        }),
      };
    }
  } catch (error) {
    console.error("CONFIG GET ERROR: Falha ao recuperar configuração.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar configuração. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
