import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as { success: boolean; data: any };
    if (!authorization?.success) {
      console.error("TAG DELETE ERROR: Não autorizado: token de autenticação ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
      success: boolean;
    };
    if (!subscriptionMiddleware.success) {
      console.error("TAG DELETE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const tagUid = event.pathParameters?.uid;

    if (!tagUid) {
      console.error("TAG DELETE ERROR: UID da tag não informado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "UID da tag não informado.",
        }),
      };
    }

    // Verificar se a tag existe e pertence ao usuário
    const existingTag = await database.client.tag.findFirst({
      where: {
        uid: tagUid,
        userUid: authorization.data.masterUid
      },
    });

    if (!existingTag) {
      console.error("TAG DELETE ERROR: Tag não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Tag não encontrada.",
        }),
      };
    }

    // Remover associações com leads e clients primeiro (devido às foreign keys)
    await database.client.leadTag.deleteMany({
      where: {
        tagUid: tagUid,
      },
    });

    await database.client.clientTag.deleteMany({
      where: {
        tagUid: tagUid,
      },
    });

    // Hard delete da tag (remoção completa do banco de dados)
    await database.client.tag.delete({
      where: {
        uid: tagUid,
      },
    });

    console.log("TAG DELETE SUCCESS: Tag deletada com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Tag deletada com sucesso.",
      }),
    };
  } catch (error) {
    console.error("TAG DELETE ERROR: Falha ao deletar tag.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao deletar tag. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};