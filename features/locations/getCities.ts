import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const { uid } = event.pathParameters || {};
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("LOCATIONS GET CITIES ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const data = await database.client.city.findMany({
      where: {
        stateUid: uid,
      },
    });

    console.log("LOCATIONS GET CITIES SUCCESS: Cidades exibidas com sucesso.", data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        msg: "Cidades exibidas com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LOCATIONS GET CITIES ERROR: Falha ao exibir cidades.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao exibir cidades.",
      }),
    };
  } finally {
    await database.client.$disconnect();
  }
};
