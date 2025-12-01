import { APIGatewayEvent } from "aws-lambda";
import * as jwt from "jsonwebtoken";
import Database from "../../database";

export const handler = async (event: APIGatewayEvent) => {
  const { token } = event.pathParameters || {};
  const database = new Database();

  if (!token) {
    console.error("AUTH ACTIVATIONEMAIL ERROR: Token é obrigatório.");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "Token é obrigatório.",
      }),
    };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "");
    const { uid, code } = decoded as { uid: string; code: string };

    const user = await database.client.user.findUnique({
      where: { uid },
    });

    if (!user || user?.activationCode !== code) {
      console.error("AUTH ACTIVATIONEMAIL ERROR: Usuário ou código de ativação incorreto.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Usuário ou código de ativação incorreto.",
        }),
      };
    }

    await database.client.user.update({
      where: { uid },
      data: {
        confirmed: true,
        activationCode: null,
      },
    });

    console.log("AUTH ACTIVATIONEMAIL SUCCESS: E-mail do usuário confirmado com sucesso.", { uid });
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "E-mail do usuário confirmado com sucesso.",
      }),
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("AUTH ACTIVATIONEMAIL ERROR: Token expirou.", error);
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token expirou.",
        }),
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      console.error("AUTH ACTIVATIONEMAIL ERROR: Token inválido.", error);
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token inválido.",
        }),
      };
    }

    console.error("AUTH ACTIVATIONEMAIL ERROR: Erro interno do servidor.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno do servidor.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
