import { APIGatewayEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

const lambda = new AWS.Lambda();

export const handler = async (event: APIGatewayEvent) => {
  const { origin, destination } = event.queryStringParameters || {};

  try {
    if (!origin || !destination) {
      console.error("LOCATIONS ROUTES ERROR: Campos obrigatórios não informados (origin, destination).");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados (origin, destination).",
        }),
      };
    }
    const response = await lambda
      .invoke({
        FunctionName: `alldo-maps-${process.env.NODE_ENV}-maps-routes`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          headers: {
            authorization: `Bearer ${process.env.ALLDO_MAPS_ACCESS_TOKEN}`,
          },
          queryStringParameters: {
            origin,
            destination,
          },
        }),
      })
      .promise();

    const payload = response.Payload ? JSON.parse(response.Payload.toString()) : {};
    console.log("ROUTES GET RESPONSE", payload);

    const body = JSON.parse(payload.body);

    if (body.success !== true) {
      console.error("LOCATIONS ROUTES ERROR: Falha ao obter rotas.", body);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha ao obter rotas.",
        }),
      };
    }

    const route = body.data;

    console.log(route);

    console.log("LOCATIONS ROUTES SUCCESS: Rotas obtidas com sucesso.", route);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: route,
        msg: "Rotas obtidas com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LOCATIONS ROUTES ERROR: Erro ao obter rotas.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro ao obter rotas.",
      }),
    };
  }
};
