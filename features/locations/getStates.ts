import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("LOCATIONS GET STATES ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const data = await database.client.state.findMany({});

    console.log("LOCATIONS GET STATES SUCCESS: Estados exibidos com sucesso.", data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        msg: "Estados exibidos com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LOCATIONS GET STATES ERROR: Falha ao exibir estados.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao exibir estados.",
      }),
    };
  } finally {
    await database.client.$disconnect();
  }
};
