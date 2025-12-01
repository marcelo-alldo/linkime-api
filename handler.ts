import { APIGatewayEvent } from "aws-lambda";
import { doGet } from "./sources/alldo-n8n/api";
export const hello = async (event: APIGatewayEvent) => {
  // Corrigido para usar o endpoint da API REST do n8n
  const response = await doGet("/workflows");
  console.log("RESPONSE DO GET:", response);
  try {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Hello World, I'm a alldo Assistente API.",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Failed to fetch data from public API.",
        error: error.message,
      }),
    };
  }
};
