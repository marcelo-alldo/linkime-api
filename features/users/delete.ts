import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};

  try {
    if (!authorization) {
      console.error("USER DELETE ERROR: Não autorizado: cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const data = await database.client.user.delete({
      where: {
        uid,
      },
    });
    console.log("USER DELETE SUCCESS: Usuário deletado com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        msg: "Usuário deletado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("USER DELETE ERROR: Falha ao deletar usuário.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao deletar usuário. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
