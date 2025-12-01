import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const { token } = JSON.parse(event.body || "");
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("NOTIFICATIONS FIREBASE TOKEN ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!token) {
      console.error("NOTIFICATIONS FIREBASE TOKEN ERROR: Campo obrigatório não informado (token).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campo obrigatório não informado: token.",
        }),
      };
    }

    const user = await database.client.user.findUnique({
      where: { uid: authorization?.data?.masterUid },
    });

    if (!user) {
      console.error("NOTIFICATIONS FIREBASE TOKEN ERROR: Usuário não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    if (user.tokenFirebase !== token) {
      // Atualizar o token no banco de dados
      await database.client.user.update({
        where: { uid: user.uid },
        data: { tokenFirebase: token },
      });
      console.log("NOTIFICATIONS FIREBASE TOKEN SUCCESS: Token atualizado com sucesso.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Token atualizado com sucesso.",
        }),
      };
    }

    // Caso o token seja válido e não tenha mudado
    console.log("NOTIFICATIONS FIREBASE TOKEN SUCCESS: Token já está atualizado.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Token já está atualizado.",
      }),
    };
  } catch (error) {
    console.error("NOTIFICATIONS FIREBASE TOKEN ERROR: Falha ao validar token.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao validar token.",
        error: error.message,
      }),
    };
  } finally {
    await database.client.$disconnect();
  }
};
