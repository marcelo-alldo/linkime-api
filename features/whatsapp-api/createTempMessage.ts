import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { message } = JSON.parse(event.body || "{}");

  console.log("EVOLUTION CREATE TEMP MESSAGE: Body recebido:", message);

  try {
    if (!authorization) {
      console.error("EVOLUTION CREATE TEMP MESSAGE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    await database.client.tempMessage.upsert({
      where: {
        id: message.key.id,
      },
      create: {
        userUid: authorization.data.masterUid,
        fromMe: false,
        remoteJid: message.key.remoteJid,
        id: message.key.id,
        body: JSON.stringify(message),
        timestamp: message.messageTimestamp,
        type: message.messageType,
      },
      update: {
        userUid: authorization.data.masterUid,
        fromMe: false,
        remoteJid: message.key.remoteJid,
        id: message.key.id,
        body: JSON.stringify(message),
        timestamp: message.messageTimestamp,
        type: message.messageType,
      },
    });

    console.log("EVOLUTION CREATE TEMP MESSAGE SUCCESS: Mensagem temporaria criada com sucesso!");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Mensagem temporaria criada com sucesso!",
      }),
    };
  } catch (error) {
    console.error("EVOLUTION CREATE TEMP MESSAGE ERROR: Falha ao criar mensagem temporaria.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar mensagem temporaria. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
