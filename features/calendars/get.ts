import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { startOfDay, addMonths } from "date-fns";
import axios from "axios";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  const today = startOfDay(new Date());
  const oneMonthLater = addMonths(today, 1);
  const after = event.queryStringParameters?.after || today.toISOString();
  const before = event.queryStringParameters?.before || oneMonthLater.toISOString();

  console.log("AUTHORIZATION", authorization);
  console.log("Query Parameters:", event.queryStringParameters);

  try {
    if (!authorization) {
      console.error("CALENDAR GET ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // LOG: Authenticated user UID
    console.log("Authenticated user UID:", authorization.data.userUid);

    const config = await database.client.userConfig.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        key: "GOOGLE-CALENDAR-WEBHOOK",
      },
    });

    // LOG: Config retrieved
    console.log("Config retrieved:", config);

    if (!config) {
      console.error("CALENDAR GET ERROR: Configuração não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Configuração não encontrada.",
        }),
      };
    }

    const response = await axios.post(config.value, {
      after,
      before,
    });

    console.log("CALENDAR GET SUCCESS: Calendario recuperado com sucesso!", response.data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: response.data,
        msg: "Calendario recuperado com sucesso!",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("Full error:", error);
    console.error("CALENDAR GET ERROR: Falha ao recuperar o calendario.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar o calendario. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
