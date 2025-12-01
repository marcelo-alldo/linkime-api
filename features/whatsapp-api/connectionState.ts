import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  let response: any;
  try {
    if (!authorization) {
      console.error("EVOLUTION CONNECTION STATE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autorização ausente ou inválido.",
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
      console.error("EVOLUTION CONNECTION STATE ERROR: Usuário não encontrado.");
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
    try {
      response = await axios.get(
        `${process.env.ALLDO_ASSISTENTE_BASE_URL}/instance/connectionState/${user.profile.email}`,
        {
          headers: {
            apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
          },
        }
      );
      console.log("EVOLUTION CONNECTION STATE SUCCESS: Status da conexão obtido com sucesso.", response.data);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Status da conexão obtido com sucesso.",
          data: response.data,
        }),
      };
    } catch (error: any) {
      // Se o erro for do Evolution (ex: not found), retorna 200 com o data do erro
      if (error.response && error.response.data) {
        console.error(
          "EVOLUTION CONNECTION STATE ERROR: Evolution retornou erro ao buscar status da conexão.",
          error.response.data
        );
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Erro ao buscar status da conexão.",
            data: error.response.data,
          }),
        };
      }
      console.error("EVOLUTION CONNECTION STATE ERROR: Falha ao obter status da conexão.", error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha ao obter status da conexão. Por favor, tente novamente mais tarde.",
        }),
      };
    }
  } finally {
    await database.disconnect();
  }
};
