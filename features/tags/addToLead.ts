import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as { success: boolean; data: any };
    if (!authorization?.success) {
      console.error("TAG ADD TO LEAD ERROR: Não autorizado: token de autenticação ausente ou inválido.");
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
      console.error("TAG ADD TO LEAD ERROR: Assinatura inválida ou expirada.");
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

    if (!uid || !tagUid) {
      console.error("TAG ADD TO LEAD ERROR: UID do lead e da tag são obrigatórios.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "UID do lead e da tag são obrigatórios.",
        }),
      };
    }

    // Verificar se o lead existe e pertence ao usuário
    const existingLead = await database.client.lead.findFirst({
      where: {
        uid,
        userUid: authorization.data.masterUid,
      },
    });

    if (!existingLead) {
      console.error("TAG ADD TO LEAD ERROR: Lead não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Lead não encontrado.",
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
      console.error("TAG ADD TO LEAD ERROR: Tag não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Tag não encontrada.",
        }),
      };
    }

    // Verificar se a associação já existe
    const existingAssociation = await database.client.leadTag.findFirst({
      where: {
        leadUid: uid,
        tagUid,
      },
    });

    if (existingAssociation) {
      // Se a associação já existe, remover a tag
      await database.client.leadTag.delete({
        where: {
          uid: existingAssociation.uid,
        },
      });

      console.log("TAG REMOVE FROM LEAD SUCCESS: Tag removida do lead com sucesso.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Tag removida do lead com sucesso.",
        }),
      };
    }

    // Criar a associação
    await database.client.leadTag.create({
      data: {
        leadUid: uid,
        tagUid,
      },
    });

    console.log("TAG ADD TO LEAD SUCCESS: Tag adicionada ao lead com sucesso.");
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Tag adicionada ao lead com sucesso.",
      }),
    };
  } catch (error) {
    console.error("TAG ADD TO LEAD ERROR: Falha ao adicionar tag ao lead.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao adicionar tag ao lead. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};