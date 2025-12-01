import { APIGatewayEvent } from "aws-lambda";
import { auth } from "../middlewares/auth.middleware";
import * as AWS from "aws-sdk";

const lambda = new AWS.Lambda();

export const handler = async (event: APIGatewayEvent) => {
  const { at } = event.queryStringParameters || {};
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("LOCATIONS REVERSE GEOCODING ERROR: Cabeçalho de autorização ausente ou inválido.");
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
        FunctionName: `alldo-maps-${process.env.NODE_ENV}-maps-reverse-geocoding`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          headers: {
            authorization: `Bearer ${process.env.ALLDO_MAPS_ACCESS_TOKEN}`,
          },
          queryStringParameters: {
            at,
          },
        }),
      })
      .promise();

    const payload = response.Payload ? JSON.parse(response.Payload.toString()) : {};
    console.log("REVERSE GEOCODING RESPONSE", payload);

    if (!payload.body) {
      console.error("LOCATIONS REVERSE GEOCODING ERROR: Resposta inválida da função de geocodificação.");
      throw new Error("Resposta inválida da função de geocodificação");
    }

    const body = JSON.parse(payload.body);

    if (body.success !== true) {
      console.error("LOCATIONS REVERSE GEOCODING ERROR: Falha no reverse geocoding.", body);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha no reverse geocoding.",
        }),
      };
    }

    console.log("LOCATIONS REVERSE GEOCODING SUCCESS: Reverse geocoding realizado com sucesso.", body.data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: body.data,
        msg: "Reverse geocoding realizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LOCATIONS REVERSE GEOCODING ERROR: Erro interno no reverse geocoding.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno no reverse geocoding.",
      }),
    };
  }
};
