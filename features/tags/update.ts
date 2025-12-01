import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as { success: boolean; data: any };
    if (!authorization?.success) {
      console.error("TAG UPDATE ERROR: Não autorizado: token de autenticação ausente ou inválido.");
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
      console.error("TAG UPDATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const tagUid = event.pathParameters?.uid;
    const { name, color } = JSON.parse(event.body || "{}");

    if (!tagUid) {
      console.error("TAG UPDATE ERROR: UID da tag não informado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "UID da tag não informado.",
        }),
      };
    }

    if (!name && !color) {
      console.error("TAG UPDATE ERROR: Nenhum campo para atualizar foi informado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Nenhum campo para atualizar foi informado.",
        }),
      };
    }

    // Validar formato da cor se fornecida
    if (color) {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexColorRegex.test(color)) {
        console.error("TAG UPDATE ERROR: Formato de cor inválido. Use formato hexadecimal (#RRGGBB).");
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            msg: "Formato de cor inválido. Use formato hexadecimal (#RRGGBB).",
          }),
        };
      }
    }

    // Verificar se a tag existe e pertence ao usuário
    const existingTag = await database.client.tag.findFirst({
      where: {
        uid: tagUid,
        userUid: authorization.data.masterUid
      },
    });

    if (!existingTag) {
      console.error("TAG UPDATE ERROR: Tag não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Tag não encontrada.",
        }),
      };
    }

    // Verificar se já existe uma tag com o mesmo nome (se o nome está sendo alterado)
    if (name && name !== existingTag.name) {
      const duplicateTag = await database.client.tag.findFirst({
        where: {
          name,
          userUid: authorization.data.masterUid,
          uid: {
            not: tagUid,
          },
        },
      });

      if (duplicateTag) {
        console.error("TAG UPDATE ERROR: Já existe uma tag com este nome.");
        return {
          statusCode: 409,
          body: JSON.stringify({
            success: false,
            msg: "Já existe uma tag com este nome.",
          }),
        };
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (color) updateData.color = color;

    const updatedTag = await database.client.tag.update({
      where: {
        uid: tagUid,
      },
      data: updateData,
    });

    console.log("TAG UPDATE SUCCESS: Tag atualizada com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Tag atualizada com sucesso.",
        data: updatedTag,
      }),
    };
  } catch (error) {
    console.error("TAG UPDATE ERROR: Falha ao atualizar tag.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar tag. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};