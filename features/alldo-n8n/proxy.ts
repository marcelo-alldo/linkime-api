import { APIGatewayEvent } from "aws-lambda";
import { auth } from "../middlewares/auth.middleware";
import { doGet, doPost, doRest } from "../../sources/alldo-n8n/api";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };
  const { url, data, method } = JSON.parse(event.body || "");

  // LOG: Received parameters
  console.log("N8N PROXY Received parameters:", { url, data, method });

  try {
    if (!authorization) {
      console.error(
        "N8N PROXY ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error(
        "N8N PROXY ERROR: Assinatura do usuário não encontrada ou inválida."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura do usuário não encontrada ou inválida.",
        }),
      };
    }

    if (!url || !method) {
      console.error(
        "N8N PROXY ERROR: Campos obrigatórios não informados (url, method)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (url, method).",
        }),
      };
    }

    let response;

    console.log("METHOD RECEIVED:", method);

    switch (method) {
      case "GET":
        try {
          response = await doGet(url);
        } catch (error) {
          console.error(
            "N8N PROXY GET ERROR: Falha ao fazer GET na URL:",
            url,
            error
          );
          return {
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              msg: "Falha ao fazer GET na URL. Por favor, tente novamente mais tarde.",
            }),
          };
        }

        break;

      case "POST":
        console.log("DATA DO POST:", data);
        try {
          if (data?.type === "googleCalendarOAuth2Api") {
            const dataParse = {
              ...data,
              data: {
                ...data.data,
                clientId: process.env.GOOLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              },
            };

            console.log("DATA PARSE:", dataParse);

            response = await doPost(url, dataParse);
          } else {
            response = await doPost(url, data);
          }
        } catch (error) {
          console.error(
            "N8N PROXY POST ERROR: Falha ao fazer POST na URL:",
            url,
            error
          );
          return {
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              msg: "Falha ao fazer POST na URL. Por favor, tente novamente mais tarde.",
            }),
          };
        }
        break;

      default:
        try {
          response = await doRest(url);
        } catch (error) {
          console.error(
            "N8N PROXY FETCH ERROR: Falha ao fazer FETCH na URL:",
            url,
            error
          );
          return {
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              msg: "Falha ao fazer FETCH na URL. Por favor, tente novamente mais tarde.",
            }),
          };
        }
        break;
    }

    // LOG: Config created successfully
    console.log(
      "N8N PROXY RESPONSE: Resposta recebida do N8N para o usuário:",
      response
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Configuração criada com sucesso.",
        data: response,
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("CONFIG CREATE ERROR: Falha ao criar configuração.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar configuração. Por favor, tente novamente mais tarde.",
      }),
    };
  }
};
