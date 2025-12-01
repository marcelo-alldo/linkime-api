import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as {
      success: boolean;
      data: any;
    };
    if (!authorization?.success) {
      console.error(
        "TAG ADD TO CLIENT ERROR: Não autorizado: token de autenticação ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    const subscriptionMiddleware = (await subscription(
      authorization.data.masterUid
    )) as {
      success: boolean;
    };
    if (!subscriptionMiddleware.success) {
      console.error(
        "TAG ADD TO CLIENT ERROR: Assinatura inválida ou expirada."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }
    const { uid } = event.pathParameters || {};
    const { tagUid } = JSON.parse(event.body || "{}");

    console.log(uid, tagUid);

    if (!uid || !tagUid) {
      console.error(
        "TAG ADD TO CLIENT ERROR: UID do client e da tag são obrigatórios."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "UID do client e da tag são obrigatórios.",
        }),
      };
    }

    // Verificar se o client existe e pertence ao usuário
    const existingClient = await database.client.client.findFirst({
      where: {
        uid,
        userUid: authorization.data.masterUid,
        enable: true,
      },
    });

    if (!existingClient) {
      console.error("TAG ADD TO CLIENT ERROR: Client não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Client não encontrado.",
        }),
      };
    }

    // Verificar se a tag existe e pertence ao usuário
    const existingTag = await database.client.tag.findFirst({
      where: {
        uid: tagUid,
        userUid: authorization.data.masterUid,
      },
    });

    if (!existingTag) {
      console.error("TAG ADD TO CLIENT ERROR: Tag não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Tag não encontrada.",
        }),
      };
    }

    // Verificar se a associação já existe
    const existingAssociation = await database.client.clientTag.findFirst({
      where: {
        clientUid: uid,
        tagUid,
      },
    });

    if (existingAssociation) {
      // Se a associação já existe, remover a tag
      await database.client.clientTag.delete({
        where: {
          uid: existingAssociation.uid,
        },
      });

      console.log("TAG REMOVE FROM CLIENT SUCCESS: Tag removida do client com sucesso.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Tag removida do client com sucesso.",
        }),
      };
    }

    // Criar a associação
    await database.client.clientTag.create({
      data: {
        clientUid: uid,
        tagUid,
      },
    });

    console.log(
      "TAG ADD TO CLIENT SUCCESS: Tag adicionada ao client com sucesso."
    );
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Tag adicionada ao client com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "TAG ADD TO CLIENT ERROR: Falha ao adicionar tag ao client.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao adicionar tag ao client. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
