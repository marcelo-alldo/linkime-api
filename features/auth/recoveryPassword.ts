import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

export const handler = async (event: APIGatewayEvent) => {
  const { token } = event.pathParameters || {};
  const { password } = JSON.parse(event.body || "");
  const database = new Database();

  if (!token) {
    console.error("AUTH RECOVERYPASSWORD ERROR: Token é obrigatório.");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "Token é obrigatório.",
      }),
    };
  }

  if (!password) {
    console.error("AUTH RECOVERYPASSWORD ERROR: Senha é obrigatória.");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "Senha é obrigatória.",
      }),
    };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "");
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("AUTH RECOVERYPASSWORD ERROR: Token expirou.", error);
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token expirou.",
        }),
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      console.error("AUTH RECOVERYPASSWORD ERROR: Token inválido.", error);
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token inválido.",
        }),
      };
    }

    console.error("AUTH RECOVERYPASSWORD ERROR: Erro interno do servidor.", error);
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
      console.error("AUTH RECOVERYPASSWORD ERROR: Usuário ou código de recuperação incorreto.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Usuário ou código de recuperação incorreto.",
        }),
      };
    }

    await database.client.user.update({
      where: { uid },
      data: {
        password: await bcrypt.hash(password, 10),
        recoveryCode: null,
      },
    });

    console.log("AUTH RECOVERYPASSWORD SUCCESS: Senha do usuário recuperada com sucesso.", { uid });
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Senha do usuário recuperada com sucesso.",
      }),
    };
  } catch (error) {
    console.error("AUTH RECOVERYPASSWORD ERROR: Erro interno do servidor.", error);

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
