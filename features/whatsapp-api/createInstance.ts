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

  try {
    if (!authorization) {
      console.error("EVOLUTION CREATE INSTANCE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("EVOLUTION CREATE INSTANCE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const user = await database.client.user.findUnique({
      where: {
        uid: authorization.data.masterUid,
      },
      include: {
        profile: true,
      },
    });

    if (!user || !user.profile || !user.profile.phone) {
      console.error("EVOLUTION CREATE INSTANCE ERROR: Usuário não encontrado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    // Remove (), espaço e - do número e adiciona DDI 55 se não tiver
    let number = user.profile.phone.replace(/[()\s-]/g, "");
    if (!number.startsWith("55")) {
      number = "55" + number;
    }

    // LOG: Verificando valor do header Authorization
    console.log("Authorization header:", process.env.ALLDO_ASSISTENTE_APIKEY ? "[DEFINED]" : "[UNDEFINED]");
    await axios.post(
      `${process.env.ALLDO_ASSISTENTE_BASE_URL}/instance/create`,
      {
        groupsIgnore: true,
        instanceName: user.profile.email,
        integration: "WHATSAPP-BAILEYS",
      },
      {
        headers: {
          apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
        },
      }
    );

    console.log("EVOLUTION CREATE INSTANCE SUCCESS: Instância criada com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Instância criada com sucesso.",
      }),
    };
  } catch (error) {
    console.error("EVOLUTION CREATE INSTANCE ERROR: Falha ao criar instância.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar instância. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
