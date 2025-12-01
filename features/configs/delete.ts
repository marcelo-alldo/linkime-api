import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const uid = event.pathParameters?.uid;

  try {
    if (!authorization.success) { // ← AQUI: verifica authorization.success
      console.error(
        "CONFIG DELETE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // Validação adicional do uid
    if (!uid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "UID não fornecido.",
        }),
      };
    }

    const result = await database.client.userConfig.delete({
      where: {
        uid,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result,
        msg: `Configuração deletada com sucesso.`,
      }),
    };
  } catch (error) {
    console.error("CONFIG DELETE ERROR: Falha ao deletar configuração.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao deletar configuração. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};