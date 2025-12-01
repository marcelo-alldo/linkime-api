import { APIGatewayEvent } from "aws-lambda";
import * as jwt from "jsonwebtoken";
import Database from "../../database";
import * as bcrypt from "bcryptjs";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const { password, userUid } = JSON.parse(event.body || "");
  const authorization = (await auth(event)) as { success: boolean; data: any };

  if (!userUid || !password) {
    console.error(
      "ADMIN GENERATE USER KEY ERROR: UserUid ou Senha não informados."
    );
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "UserUid ou Senha não informados.",
      }),
    };
  }

  try {
    if (!authorization) {
      console.error(
        "ADMIN GENERATE USER KEY ERROR: Não autorizado: cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (authorization.data.role !== "admin") {
      console.error(
        "ADMIN GENERATE USER KEY ERROR: Acesso negado. Usuário não é um administrador."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Acesso negado. Usuário não é um administrador.",
        }),
      };
    }

    const passKey =
      "$2a$10$An4UO./VgvTfpfoYL.mD9ePgYilsgkJRzFb3jYNENue.rikpxZWHu";

    if (!(await bcrypt.compare(password, passKey))) {
      console.error("ADMIN GENERATE USER KEY ERROR: Senha incorreta.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Senha incorreta.",
        }),
      };
    }

    const user = await database.client.user.findUnique({
      where: { uid: userUid },
      include: {
        profile: true,
        parent: true,
        collaborators: true,
        userFeatures: { include: { role: true, feature: true } },
        subscriptions: {
          include: { subscription: true },
          where: { status: { not: "CANCELED" } },
        },
      },
    });

    console.log(
      "ADMIN GENERATE USER KEY ERROR: Criação da chave para o usuário:",
      user
    );

    if (!user) {
      console.error("ADMIN GENERATE USER KEY ERROR: Usuário inválido.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Usuário inválido.",
        }),
      };
    }

    const key = jwt.sign(
      {
        uid: user?.uid,
        role: user?.userFeatures?.[0]?.role?.name || "user",
        parentUid: user?.collaborators?.[0]?.parentUid,
        subscription: user?.subscriptions?.[0]?.subscriptionUid || null,
      },
      process.env.JWT_SECRET || "",
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          user_key: key,
        },
        msg: "Chave gerada com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "ADMIN GENERATE USER KEY ERROR: Erro interno no servidor.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno no servidor.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
