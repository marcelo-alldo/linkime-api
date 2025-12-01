import { APIGatewayEvent } from "aws-lambda";
import { auth } from "../middlewares/auth.middleware";
import * as AWS from "aws-sdk";

const lambda = new AWS.Lambda();

export const handler = async (event: APIGatewayEvent) => {
  const { q } = event.queryStringParameters || {};
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("LOCATIONS GEOCODING ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const response = await lambda
      .invoke({
        FunctionName: `alldo-maps-${process.env.NODE_ENV}-maps-geocoding`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          headers: {
            authorization: `Bearer ${process.env.ALLDO_MAPS_ACCESS_TOKEN}`,
          },
          queryStringParameters: {
            q,
          },
        }),
      })
      .promise();

    const payload = response.Payload ? JSON.parse(response.Payload.toString()) : {};
    console.log("GEOCODING RESPONSE", payload);

    if (!payload.body) {
      console.error("LOCATIONS GEOCODING ERROR: Resposta inválida da função de geocodificação.");
      throw new Error("Resposta inválida da função de geocodificação");
    }

    const body = JSON.parse(payload.body);

    if (body.success !== true) {
      console.error("LOCATIONS GEOCODING ERROR: Falha no geocoding.", body);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha no geocoding.",
        }),
      };
    }

    console.log("LOCATIONS GEOCODING SUCCESS: Geocoding realizado com sucesso.", body.data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: body.data,
        msg: "Geocoding realizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LOCATIONS GEOCODING ERROR: Erro interno no geocoding.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno no geocoding.",
      }),
    };
  }
};
