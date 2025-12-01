import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import * as jwt from "jsonwebtoken";

export const handler = async (event: APIGatewayEvent) => {
  const { token } = event.pathParameters || {};
  const database = new Database();

  if (!token) {
    console.error("AUTH CHECK RECOVERY PASSWORD ERROR: Token é obrigatório.");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "Token é obrigatório.",
      }),
    };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "");
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("AUTH CHECK RECOVERY PASSWORD ERROR: Token expirou.", error);
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token expirou.",
        }),
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      console.error("AUTH CHECK RECOVERY PASSWORD ERROR: Token inválido.", error);
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token inválido.",
        }),
      };
    }

    console.error("AUTH CHECK RECOVERY PASSWORD ERROR: Erro interno do servidor.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno do servidor.",
      }),
    };
  }

  const { uid, code } = decoded as { uid: string; code: string };

  try {
    const user = await database.client.user.findUnique({
      where: { uid },
    });

    if (!user || user?.recoveryCode !== code) {
      console.error("AUTH CHECK RECOVERY PASSWORD ERROR: Usuário ou código de recuperação incorreto.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Usuário ou código de recuperação incorreto.",
        }),
      };
    }

    console.log("AUTH CHECK RECOVERY PASSWORD SUCCESS: Código de recuperação do usuário ok.", { uid });
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Código de recuperação do usuário ok.",
      }),
    };
  } catch (error) {
    console.error("AUTH CHECK RECOVERY PASSWORD ERROR: Erro interno do servidor.", error);

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
