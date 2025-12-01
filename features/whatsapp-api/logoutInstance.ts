import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("EVOLUTION LOGOUT INSTANCE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
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
      console.error("EVOLUTION LOGOUT INSTANCE ERROR: Usuário não encontrado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    // LOG: Verificando valor do header Authorization
    console.log("Authorization header:", process.env.ALLDO_ASSISTENTE_APIKEY ? "[DEFINED]" : "[UNDEFINED]");
    await axios.delete(`${process.env.ALLDO_ASSISTENTE_BASE_URL}/instance/logout/${user.profile.email}`, {
      headers: {
        apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
      },
    });

    console.log("EVOLUTION LOGOUT INSTANCE SUCCESS: Instância deslogada com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Instância deslogada com sucesso.",
      }),
    };
  } catch (error) {
    console.error("EVOLUTION LOGOUT INSTANCE ERROR: Falha ao deslogar instância.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao deslogar instância. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
