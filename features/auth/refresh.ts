import { APIGatewayEvent } from "aws-lambda";
import { User } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import Database from "../../database";

export const handler = async (event: APIGatewayEvent) => {
  const { token } = JSON.parse(event.body || "");
  const database = new Database();

  let decodedToken: any;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET || "");
  } catch (error) {
    console.error("AUTH REFRESH ERROR: Token inválido.", error);
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        msg: "Token inválido.",
      }),
    };
  }

  const idUser = decodedToken.uid;

  try {
    const user: User | null = await database.client.user.findUnique({ where: { uid: idUser } });

    if (!user) {
      console.error("AUTH REFRESH ERROR: Token inválido. Usuário não encontrado.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token inválido.",
        }),
      };
    }

    const newToken = jwt.sign(
      {
        id: user?.uid,
      },
      process.env.JWT_SECRET || "",
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );

    console.log("AUTH REFRESH SUCCESS: Novo token gerado para o usuário.", { uid: user?.uid });
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        "New-Access-Token": {
          access_token: newToken,
        },
        msg: "Usuário logado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("AUTH REFRESH ERROR: Erro interno do servidor.", error);
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
